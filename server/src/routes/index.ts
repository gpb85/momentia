import { Router } from "express";
import healthRoutes from "../modules/health/health.routes";
import adminEventsRoutes from "../modules/admin-events/admin-events.routes";

const router = Router();

router.use("/health", healthRoutes);
router.use("/admin/events", adminEventsRoutes);

export default router;
