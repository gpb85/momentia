import { Router } from "express";
import healthRoutes from "../modules/health/health.routes";
import adminEventsRoutes from "../modules/admin-events/admin-events.routes";
import accessRoutes from "../modules/access/access.routes";
const router = Router();
router.use("/health", healthRoutes);
router.use("/admin/events", adminEventsRoutes);
router.use("/access", accessRoutes);
export default router;
