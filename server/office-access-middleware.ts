import type { NextFunction, Response } from "express";
import {
  canAccessDepartment,
  canAccessOfficeApi,
  canManageWorker,
  filterOperationalPayload,
  hasOperationalDepartmentScope,
} from "@shared/permissionMatrix";
import type { AuthenticatedRequest } from "./auth-service";

export function enforceOfficeApiAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const pathname = req.originalUrl.split("?")[0];
  if (!req.user || !canAccessOfficeApi(req.user, req.method, pathname)) {
    return res.status(403).json({ error: "Your role does not have access to this module" });
  }

  if (hasOperationalDepartmentScope(req.user)) {
    const requestedDepartmentId =
      (req.params?.departmentId as string | undefined) ||
      (req.query?.departmentId as string | undefined) ||
      (req.body?.departmentId as string | undefined);
    if (requestedDepartmentId && !canAccessDepartment(req.user, requestedDepartmentId)) {
      return res.status(403).json({ error: "You can only access your assigned departments" });
    }

    const requestedWorkerId =
      (req.params?.workerId as string | undefined) ||
      (req.query?.workerId as string | undefined) ||
      (req.body?.employeeId as string | undefined) ||
      (req.body?.workerId as string | undefined);
    if (requestedWorkerId && !canManageWorker(req.user, requestedWorkerId)) {
      return res.status(403).json({ error: "You can only access staff in your assigned departments" });
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => originalJson(filterOperationalPayload(req.user!, body))) as typeof res.json;
  }
  next();
}