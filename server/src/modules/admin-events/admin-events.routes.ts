import { Router } from "express";
import { createAdminEvent } from "./admin-events.controller";
import { validate } from "../../middlewares/validate.middleware";
import { createEventSchema } from "./admin-events.schema";

const router = Router();

router.post("/", validate(createEventSchema), createAdminEvent);

export default router;
