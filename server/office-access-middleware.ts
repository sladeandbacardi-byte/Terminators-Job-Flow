import type { NextFunction, Response } from "express";
import { getDashboardRole } from "@shared/dashboardRole";
import { getOfficeApiAllowedRoles } from "@shared/officeApiPolicy";
import type { AuthenticatedRequest } from "./auth-service";

export function enforceOfficeApiAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const pathname = req.originalUrl.split("?")[0];
  const allowedRoles = getOfficeApiAllowedRoles(req.method, pathname);
  if (!allowedRoles.includes(getDashboardRole(req.user ?? {}))) {
    return res.status(403).json({ error: "Your role does not have access to this module" });
  }
  next();
}