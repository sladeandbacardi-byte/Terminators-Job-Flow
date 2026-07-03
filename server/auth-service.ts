import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { adminUsers, userSessions, activityLogs } from '@shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import type { AdminUser, InsertAdminUser, InsertActivityLog } from '@shared/schema';
import { getDashboardRole } from '@shared/dashboardRole';
import { storage } from './storage';

const JWT_SECRET = process.env.JWT_SECRET || 'terminators_default_secret_key_2024';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Tokens issued by the app's real sign-in flow (the "choose your profile"
// screen at POST /api/auth/login) look like `token_<workerId>_<issuedAtMs>`.
// They are NOT JWTs and have no row in `user_sessions`, so they must be
// validated separately from the (currently unused in the UI) admin
// username/password login handled by AuthService.authenticateUser below.
const WORKER_TOKEN_RE = /^token_(.+)_(\d{10,})$/;
const WORKER_TOKEN_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours, mirrors SESSION_DURATION

async function resolveWorkerToken(token: string): Promise<AdminUser | null> {
  const match = token.match(WORKER_TOKEN_RE);
  if (!match) return null;

  const [, workerId, issuedAtStr] = match;
  const issuedAt = Number(issuedAtStr);
  if (!issuedAt || Date.now() - issuedAt > WORKER_TOKEN_MAX_AGE) return null;

  try {
    const worker = await storage.getWorker(workerId);
    if (!worker || worker.isActive === false) return null;

    const effectiveRole = getDashboardRole({ departmentId: worker.departmentId, role: worker.role });
    const [firstName, ...rest] = (worker.name || '').split(' ');

    return {
      id: worker.id,
      username: worker.name,
      email: worker.email || '',
      passwordHash: '',
      firstName: firstName || worker.name,
      lastName: rest.join(' '),
      role: effectiveRole,
      isActive: true,
      lastLoginAt: null,
      createdAt: worker.createdAt ?? new Date(),
      updatedAt: new Date(),
    } as AdminUser;
  } catch (error) {
    console.error('Worker token resolution error:', error);
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: AdminUser;
}

export class AuthService {
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

  // Verify JWT token
  static verifyToken(token: string): { userId: string } | null {
    try {
      return jwt.verify(token, JWT_SECRET) as { userId: string };
    } catch {
      return null;
    }
  }

  // Create admin user
  static async createAdminUser(userData: InsertAdminUser & { password: string }): Promise<AdminUser> {
    const { password, ...userDataWithoutPassword } = userData;
    const passwordHash = await this.hashPassword(password);
    
    const [user] = await db.insert(adminUsers).values({
      ...userDataWithoutPassword,
      passwordHash,
    }).returning();
    
    return user;
  }

  // Authenticate user login
  static async authenticateUser(username: string, password: string): Promise<{ user: AdminUser; token: string } | null> {
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
        user: { ...user, lastLoginAt: new Date() }, 
        token 
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return null;
    }
  }

  // Get user by ID
  static async getUserById(userId: string): Promise<AdminUser | null> {
    try {
      const [user] = await db
        .select()
        .from(adminUsers)
        .where(and(
          eq(adminUsers.id, userId),
          eq(adminUsers.isActive, true)
        ));
      
      return user || null;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }

  // Validate session
  static async validateSession(token: string): Promise<AdminUser | null> {
    try {
      const decoded = this.verifyToken(token);
      if (!decoded) {
        return null;
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

  // Logout user (invalidate session)
  static async logoutUser(token: string): Promise<boolean> {
    try {
      await db
        .delete(userSessions)
        .where(eq(userSessions.sessionToken, token));
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
        .where(gt(userSessions.expiresAt, new Date()));
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

    // Tokens from the app's real login screen (worker profile picker) use a
    // different format than the JWT-based admin session — check that first.
    const workerUser = await resolveWorkerToken(token);
    if (workerUser) {
      req.user = workerUser;
      return next();
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