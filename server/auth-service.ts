import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { adminUsers, userSessions, officeWorkerSessions, mobileWorkerSessions, activityLogs } from '@shared/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import { randomUUID } from "crypto";
import type { AdminUser, InsertAdminUser, InsertActivityLog } from '@shared/schema';
import { storage } from './storage';
import {
  isPasswordlessMobileWorker,
  isPasswordlessOfficeWorker,
  isSolePasswordAdministrator,
} from "./office-account-policy";

const configuredSecret = process.env.JWT_SECRET?.trim() || process.env.SESSION_SECRET?.trim();
if (!configuredSecret) {
  throw new Error(
    "Missing SESSION_SECRET or JWT_SECRET in Railway Variables. Add one under Railway > App Service > Variables.",
  );
}
const JWT_SECRET: string = configuredSecret;
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export type AuthenticatedUser = AdminUser & {
  sourceWorkerId?: string | null;
  sourceWorkerName?: string | null;
  sourceWorkerRole?: string | null;
  sourceWorkerDepartmentId?: string | null;
  authenticationMethod?: "profile_picker" | "password" | "passwordless_office";
};

type MobileWorkerSessionClaims = {
  workerId: string;
  sessionId: string;
  tokenType: "mobile_worker_v3";
};
type OfficeWorkerSessionClaims = {
  workerId: string;
  tokenType: "office_worker_v1";
};

export type MobileAuthenticatedRequest = Request & {
  mobileWorker?: Awaited<ReturnType<typeof storage.getWorker>>;
};

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export class AuthService {
  static async enrichAdminUser(user: AdminUser): Promise<AuthenticatedUser> {
    const allWorkers = await storage.getWorkers();
    const normalizedEmail = user.email.trim().toLowerCase();
    const normalizedName = `${user.firstName} ${user.lastName}`.trim().replace(/\s+/g, " ").toLowerCase();
    const matches = allWorkers.filter(worker =>
      worker.isActive !== false && (
        worker.id === user.id ||
        worker.email.trim().toLowerCase() === normalizedEmail ||
        worker.name.trim().replace(/\s+/g, " ").toLowerCase() === normalizedName
      ),
    );
    const worker = matches.length === 1 ? matches[0] : undefined;

    return {
      ...user,
      sourceWorkerId: worker?.id ?? null,
      sourceWorkerName: worker?.name ?? null,
      sourceWorkerRole: worker?.role ?? null,
      sourceWorkerDepartmentId: worker?.departmentId ?? null,
      authenticationMethod: "password",
    };
  }

  // Hash password
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  // Verify password
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Generate JWT token
  static generateToken(userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
  }

  static generateMobileWorkerToken(workerId: string, sessionId = randomUUID()): string {
    return jwt.sign({ workerId, sessionId, tokenType: "mobile_worker_v3" }, JWT_SECRET, { expiresIn: "12h" });
  }

  static async authenticatePasswordlessMobileWorker(workerId: string): Promise<{ worker: NonNullable<Awaited<ReturnType<typeof storage.getWorker>>>; token: string } | null> {
    const worker = await storage.getWorker(workerId);
    if (!worker || !isPasswordlessMobileWorker(worker)) return null;
    const sessionId = randomUUID();
    const token = this.generateMobileWorkerToken(worker.id, sessionId);
    await db.insert(mobileWorkerSessions).values({
      id: sessionId,
      workerId: worker.id,
      sessionToken: token,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    });
    return { worker, token };
  }

  static async validateMobileWorkerSession(token: string) {
    const claims = this.verifyMobileWorkerToken(token);
    if (!claims) return null;
    const [session] = await db.select().from(mobileWorkerSessions).where(and(
      eq(mobileWorkerSessions.id, claims.sessionId),
      eq(mobileWorkerSessions.workerId, claims.workerId),
      eq(mobileWorkerSessions.sessionToken, token),
      gt(mobileWorkerSessions.expiresAt, new Date()),
    ));
    if (!session) return null;
    const worker = await storage.getWorker(claims.workerId);
    return worker && isPasswordlessMobileWorker(worker) ? worker : null;
  }

  static async revokeMobileWorkerSession(token: string): Promise<void> {
    await db.delete(mobileWorkerSessions).where(eq(mobileWorkerSessions.sessionToken, token));
  }

  private static verifyMobileWorkerToken(token: string): MobileWorkerSessionClaims | null {
    try {
      const claims = jwt.verify(token, JWT_SECRET) as Partial<MobileWorkerSessionClaims>;
      return claims.tokenType === "mobile_worker_v3"
        && typeof claims.workerId === "string"
        && typeof claims.sessionId === "string"
        ? claims as MobileWorkerSessionClaims
        : null;
    } catch {
      return null;
    }
  }

  static async authenticatePasswordlessOfficeWorker(
    workerId: string,
  ): Promise<{ user: AuthenticatedUser; token: string } | null> {
    const worker = await storage.getWorker(workerId);
    if (!worker || !isPasswordlessOfficeWorker(worker)) return null;

    const token = jwt.sign(
      { workerId: worker.id, tokenType: "office_worker_v1" } satisfies OfficeWorkerSessionClaims,
      JWT_SECRET,
      { expiresIn: "24h" },
    );
    await db.insert(officeWorkerSessions).values({
      workerId: worker.id,
      sessionToken: token,
      expiresAt: new Date(Date.now() + SESSION_DURATION),
    });
    return { user: this.officeWorkerAsUser(worker), token };
  }

  private static officeWorkerAsUser(worker: Awaited<ReturnType<typeof storage.getWorker>>): AuthenticatedUser {
    if (!worker) throw new Error("Worker required");
    return {
      id: worker.id,
      username: worker.email,
      email: worker.email,
      passwordHash: "",
      firstName: worker.name.split(/\s+/)[0] || worker.name,
      lastName: worker.name.split(/\s+/).slice(1).join(" "),
      role: worker.role || "Office User",
      isActive: true,
      lastLoginAt: null,
      createdAt: worker.createdAt,
      updatedAt: worker.createdAt,
      sourceWorkerId: worker.id,
      sourceWorkerName: worker.name,
      sourceWorkerRole: worker.role,
      sourceWorkerDepartmentId: worker.departmentId,
      authenticationMethod: "passwordless_office",
    };
  }

  // Verify JWT token
  static verifyToken(token: string): { userId: string } | null {
    try {
      const claims = jwt.verify(token, JWT_SECRET) as Partial<{ userId: string }>;
      return typeof claims.userId === "string" && claims.userId.length > 0
        ? { userId: claims.userId }
        : null;
    } catch {
      return null;
    }
  }

  // Create admin user
  static async createAdminUser(userData: Omit<InsertAdminUser, "passwordHash"> & { password: string }): Promise<AdminUser> {
    const { password, ...userDataWithoutPassword } = userData;
    const passwordHash = await this.hashPassword(password);
    
    const [user] = await db.insert(adminUsers).values({
      ...userDataWithoutPassword,
      passwordHash,
    }).returning();
    
    return user;
  }

  // Authenticate user login
  static async authenticateUser(username: string, password: string): Promise<{ user: AuthenticatedUser; token: string } | null> {
    try {
      const [user] = await db
        .select()
        .from(adminUsers)
        .where(and(
          eq(adminUsers.username, username),
          eq(adminUsers.isActive, true)
        ));

      if (!user) {
        return null;
      }
      if (!isSolePasswordAdministrator(user)) {
        return null;
      }

      const isValidPassword = await this.verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        return null;
      }

      // Update last login
      await db
        .update(adminUsers)
        .set({ lastLoginAt: new Date() })
        .where(eq(adminUsers.id, user.id));

      // Create session
      const token = this.generateToken(user.id);
      const expiresAt = new Date(Date.now() + SESSION_DURATION);
      
      await db.insert(userSessions).values({
        userId: user.id,
        sessionToken: token,
        expiresAt,
      });

      return {
        user: await this.enrichAdminUser({ ...user, lastLoginAt: new Date() }),
        token 
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return null;
    }
  }

  // Get user by ID
  static async getUserById(userId: string): Promise<AuthenticatedUser | null> {
    try {
      const [user] = await db
        .select()
        .from(adminUsers)
        .where(and(
          eq(adminUsers.id, userId),
          eq(adminUsers.isActive, true)
        ));
      
      return user && isSolePasswordAdministrator(user) ? await this.enrichAdminUser(user) : null;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }

  // Validate session
  static async validateSession(token: string): Promise<AuthenticatedUser | null> {
    try {
      const decoded = this.verifyToken(token);
      if (!decoded) {
        const officeClaims = this.verifyOfficeWorkerToken(token);
        if (!officeClaims) return null;
        const [session] = await db.select().from(officeWorkerSessions).where(and(
          eq(officeWorkerSessions.sessionToken, token),
          gt(officeWorkerSessions.expiresAt, new Date()),
        ));
        if (!session || session.workerId !== officeClaims.workerId) return null;
        const worker = await storage.getWorker(session.workerId);
        return worker && isPasswordlessOfficeWorker(worker) ? this.officeWorkerAsUser(worker) : null;
      }

      // Check if session exists and is not expired
      const [session] = await db
        .select()
        .from(userSessions)
        .where(and(
          eq(userSessions.sessionToken, token),
          gt(userSessions.expiresAt, new Date())
        ));

      if (!session) {
        return null;
      }

      return this.getUserById(session.userId);
    } catch (error) {
      console.error('Session validation error:', error);
      return null;
    }
  }

  private static verifyOfficeWorkerToken(token: string): OfficeWorkerSessionClaims | null {
    try {
      const claims = jwt.verify(token, JWT_SECRET) as Partial<OfficeWorkerSessionClaims>;
      return claims.tokenType === "office_worker_v1" && typeof claims.workerId === "string"
        ? claims as OfficeWorkerSessionClaims
        : null;
    } catch {
      return null;
    }
  }

  // Logout user (invalidate session)
  static async logoutUser(token: string): Promise<boolean> {
    try {
      await db
        .delete(userSessions)
        .where(eq(userSessions.sessionToken, token));
      await db
        .delete(officeWorkerSessions)
        .where(eq(officeWorkerSessions.sessionToken, token));
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      return false;
    }
  }

  // Log user activity
  static async logActivity(logData: InsertActivityLog): Promise<void> {
    try {
      await db.insert(activityLogs).values(logData);
    } catch (error) {
      console.error('Activity logging error:', error);
    }
  }

  // Clean expired sessions
  static async cleanExpiredSessions(): Promise<void> {
    try {
      await db
        .delete(userSessions)
        .where(sql`expires_at <= ${new Date()}`);
      await db.delete(officeWorkerSessions).where(sql`expires_at <= ${new Date()}`);
      await db.delete(mobileWorkerSessions).where(sql`expires_at <= ${new Date()}`);
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  }
}

// Authentication middleware
export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Authentication token required' });
    }

    const user = await AuthService.validateSession(token);
    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Authentication error' });
  }
};

export const requireMobileTechnician = async (req: MobileAuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Mobile session token required" });

    const worker = await AuthService.validateMobileWorkerSession(token);
    if (!worker) return res.status(401).json({ message: "Invalid or expired mobile session" });

    req.mobileWorker = worker;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired mobile session" });
  }
};

// Activity logging middleware
export const logActivity = (action: string, resource?: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Store original send function
    const originalSend = res.send;
    
    // Override send to capture when response is sent
    res.send = function(body) {
      // Log activity after successful response
      if (req.user && res.statusCode < 400) {
        const resourceId = req.params.id || req.body?.id || null;
        
        AuthService.logActivity({
          userId: req.user.id,
          action,
          resource,
          resourceId,
          details: JSON.stringify({
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
          }),
          ipAddress: req.ip || req.connection.remoteAddress || null,
          userAgent: req.headers['user-agent'] || null,
        });
      }
      
      // Call original send
      return originalSend.call(this, body);
    };
    
    next();
  };
};