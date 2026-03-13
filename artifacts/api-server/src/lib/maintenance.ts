import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getSetting } from "./settings";
import { verifyTokenAsync } from "./auth";

export async function maintenanceMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path === "/healthz" || req.path.startsWith("/auth")) {
    return next();
  }

  const maintenanceMode = await getSetting("maintenance_mode");
  if (maintenanceMode !== "true") {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = await verifyTokenAsync(token);
    if (payload) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
      if (user?.role === "super_admin") {
        return next();
      }
    }
  }

  res.status(503).json({
    error: "Service Unavailable",
    message: "The platform is currently undergoing maintenance. Please try again later.",
  });
}
