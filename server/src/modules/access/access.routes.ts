import { Router } from "express";
import { createSubfolderByToken, getAccessByToken } from "./access.controllers";
const router = Router();
router.get("/:token", getAccessByToken);
router.post("/:token/subfolders", createSubfolderByToken);
export default router;
