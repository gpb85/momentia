import crypto from "crypto";
import { Request, Response } from "express";
import {
  createSubfolderFromAccess,
  logAccessVisit,
  resolveAccessToken,
} from "./access.service";
import { createSubfolderSchema } from "./access.schema";
import { env } from "../../config/env";
const sha256 = (v: string): string => {
  return crypto.createHash("sha256").update(v).digest("hex");
};
const getVisitorKey = (req: Request, res: Response): string => {
  const existing = req.cookies?.visitor_key as string | undefined;
  if (existing) {
    return existing;
  }
  const key = crypto.randomBytes(16).toString("hex");
  res.cookie("visitor_key", key, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 365,
  });
  return key;
};
const getTokenParam = (value: string | string[] | undefined): string | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] : value;
};
export const getAccessByToken = async (req: Request, res: Response) => {
  const token = getTokenParam(req.params.token);
  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }
  const data = await resolveAccessToken(token);
  if (!data) {
    return res.status(404).json({ message: "Access link not found" });
  }
  if (!data.is_active) {
    return res.status(403).json({ message: "Access link inactive" });
  }
  const visitorKey = getVisitorKey(req, res);
  const ip =
    typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0]
      : req.ip;
  const visitType =
    data.access_type === "event_dashboard"
      ? "dashboard_view"
      : data.access_type === "global_upload" ||
          data.access_type === "subfolder_upload"
        ? "upload_page_view"
        : data.access_type === "subfolder_dashboard"
          ? "dashboard_view"
          : "open";
  await logAccessVisit({
    accessLinkId: data.id,
    eventId: data.event_id,
    folderId: data.folder_id,
    visitorKey,
    ipHash: ip ? sha256(ip) : null,
    userAgent:
      typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"]
        : null,
    referer:
      typeof req.headers.referer === "string" ? req.headers.referer : null,
    visitType,
  });
  const permissions =
    data.access_type === "event_dashboard"
      ? {
          canViewEventDashboard: true,
          canViewGlobalFolder: true,
          canCreateSubfolder: true,
          canUploadImagesToGlobalFolder: false,
          canUploadVideosToGlobalFolder: false,
          canViewSubfolderDashboard: false,
          canUploadToSubfolder: false,
          canDownloadSubfolderMedia: false,
          canDeleteSubfolder: false,
        }
      : data.access_type === "global_upload"
        ? {
            canViewEventDashboard: false,
            canViewGlobalFolder: false,
            canCreateSubfolder: false,
            canUploadImagesToGlobalFolder: true,
            canUploadVideosToGlobalFolder: false,
            canViewSubfolderDashboard: false,
            canUploadToSubfolder: false,
            canDownloadSubfolderMedia: false,
            canDeleteSubfolder: false,
          }
        : data.access_type === "subfolder_upload"
          ? {
              canViewEventDashboard: false,
              canViewGlobalFolder: false,
              canCreateSubfolder: false,
              canUploadImagesToGlobalFolder: false,
              canUploadVideosToGlobalFolder: false,
              canViewSubfolderDashboard: false,
              canUploadToSubfolder: true,
              canUploadImagesToSubfolder: true,
              canUploadVideosToSubfolder: true,
              canDownloadSubfolderMedia: false,
              canDeleteSubfolder: false,
            }
          : data.access_type === "subfolder_dashboard"
            ? {
                canViewEventDashboard: false,
                canViewGlobalFolder: false,
                canCreateSubfolder: false,
                canUploadImagesToGlobalFolder: false,
                canUploadVideosToGlobalFolder: false,
                canViewSubfolderDashboard: true,
                canUploadToSubfolder: false,
                canDownloadSubfolderMedia: true,
                canDeleteSubfolder: true,
              }
            : {};
  return res.json({
    message: "Access resolved",
    data: {
      accessType: data.access_type,
      event: { title: data.title, slug: data.slug },
      folder: data.folder_name
        ? { name: data.folder_name, type: data.folder_type }
        : null,
      permissions,
    },
  });
};
export const createSubfolderByToken = async (req: Request, res: Response) => {
  const token = getTokenParam(req.params.token);
  if (!token) {
    return res.status(400).json({ message: "Token is required" });
  }
  const parsed = createSubfolderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "Validation failed", errors: parsed.error.flatten() });
  }
  const result = await createSubfolderFromAccess(token, parsed.data);
  const baseUrl = env.APP_BASE_URL || `http://localhost:${env.PORT}`;
  return res.status(201).json({
    message: "Subfolder created successfully",
    data: {
      subfolder: result.subfolder,
      accessLinks: {
        subfolderUpload: {
          ...result.accessLinks.subfolderUpload,
          url: `${baseUrl}/api/access/${result.accessLinks.subfolderUpload.access_token}`,
        },
        subfolderDashboard: {
          ...result.accessLinks.subfolderDashboard,
          url: `${baseUrl}/api/access/${result.accessLinks.subfolderDashboard.access_token}`,
        },
      },
    },
  });
};
