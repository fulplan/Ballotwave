import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import schoolsRouter from "./schools";
import electionsRouter from "./elections";
import candidatesRouter from "./candidates";
import paymentsRouter from "./payments";
import analyticsRouter from "./analytics";
import usersRouter from "./users";
import settingsRouter from "./settings";
import { maintenanceMiddleware } from "../lib/maintenance";

const router: IRouter = Router();

router.use(healthRouter);
router.use(maintenanceMiddleware);

router.use("/auth", authRouter);
router.use("/schools", schoolsRouter);
router.use("/elections", electionsRouter);
router.use("/elections/:electionId/candidates", candidatesRouter);
router.use("/payments", paymentsRouter);
router.use("/analytics", analyticsRouter);
router.use("/users", usersRouter);
router.use("/settings", settingsRouter);

export default router;
