import type { RequestHandler } from "express";
import { z } from "zod";
import type { AuthenticatedUser } from "./auth-service";
import type { RateLimitDecision } from "./request-limits";

type AuthenticationResult = { user: AuthenticatedUser; token: string } | null;

export function createPasswordLoginHandler(dependencies: {
  authenticate: (username: string, password: string) => Promise<AuthenticationResult>;
}): RequestHandler {
  return async (req, res) => {
    try {
      const parsed = z.object({
        username: z.string().trim().min(1).max(200),
        password: z.string().min(1).max(10_000),
      }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Username and password are required" });
      const result = await dependencies.authenticate(parsed.data.username, parsed.data.password);
      if (!result) return res.status(401).json({ message: "Invalid username or password" });
      const { passwordHash: _passwordHash, ...safeUser } = result.user;
      return res.json({ token: result.token, user: safeUser });
    } catch (error) {
      console.error("Administrator login error:", error);
      return res.status(500).json({ message: "Unable to sign in" });
    }
  };
}

export function createPasswordlessOfficeLoginHandler(dependencies: {
  authenticate: (workerId: string) => Promise<AuthenticationResult>;
  rateLimit: (clientKey: string, workerId: string) => RateLimitDecision;
  clientKey: (req: any) => string;
  logLogin: (user: AuthenticatedUser, req: any) => Promise<void>;
}): RequestHandler {
  return async (req, res) => {
    try {
      const parsed = z.object({ workerId: z.string().trim().regex(/^worker-[1-6]$/) }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Office user is required" });

      const decision = dependencies.rateLimit(dependencies.clientKey(req), parsed.data.workerId);
      if (!decision.allowed) {
        res.set("Retry-After", String(decision.retryAfterSeconds));
        return res.status(429).json({
          error: "Too many requests. Please try again later.",
          retryAfterSeconds: decision.retryAfterSeconds,
        });
      }

      const result = await dependencies.authenticate(parsed.data.workerId);
      if (!result) {
        return res.status(401).json({ message: "This office profile is not eligible for passwordless sign-in" });
      }

      const { passwordHash: _passwordHash, ...safeUser } = result.user;
      await dependencies.logLogin(result.user, req);
      return res.json({ token: result.token, user: safeUser });
    } catch (error) {
      console.error("Passwordless office login error:", error);
      return res.status(500).json({ message: "Unable to sign in" });
    }
  };
}