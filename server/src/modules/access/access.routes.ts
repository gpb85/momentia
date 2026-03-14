import { Router } from "express";
import {
  createSubfolderByToken,
  getAccessByToken,
  uploadMediaByToken,
} from "./access.controllers";
import { uploadSingle } from "../../middlewares/upload.middleware";

const router = Router();

/**
 * GET /api/access/:token
 * resolve QR token + permissions + analytics
 */
router.get("/:token", getAccessByToken);

/**
 * POST /api/access/:token/subfolders
 * create subfolder μέσω event dashboard QR
 */
router.post("/:token/subfolders", createSubfolderByToken);

/**
 * POST /api/access/:token/upload
 * upload media μέσω QR
 */
router.post("/:token/upload", uploadSingle, uploadMediaByToken);

export default router;
