import { db } from "../../config/db";
import { generateAccessToken } from "../../utils/token";
import { CreateSubfolderInput } from "./access.schema";

type AccessType =
  | "event_dashboard"
  | "global_upload"
  | "subfolder_upload"
  | "subfolder_dashboard";
export const resolveAccessToken = async (token: string) => {
  const result = await db.query(
    ` SELECT al.id, al.access_type, al.label, al.event_id, al.folder_id, al.is_active, e.title, e.slug, e.client_name, e.client_email, e.description, e.event_date::text, e.cover_image_url, f.name AS folder_name, f.folder_type, f.parent_id FROM access_links al JOIN events e ON e.id = al.event_id LEFT JOIN folders f ON f.id = al.folder_id WHERE al.access_token = $1 LIMIT 1 `,
    [token],
  );
  if (!result.rows.length) return null;
  return result.rows[0];
};
export const logAccessVisit = async (data: {
  accessLinkId: string;
  eventId: string;
  folderId?: string | null;
  visitorKey?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  referer?: string | null;
  visitType: string;
}) => {
  await db.query(
    ` INSERT INTO access_link_visits ( access_link_id, event_id, folder_id, visitor_key, ip_hash, user_agent, referer, visit_type ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) `,
    [
      data.accessLinkId,
      data.eventId,
      data.folderId || null,
      data.visitorKey || null,
      data.ipHash || null,
      data.userAgent || null,
      data.referer || null,
      data.visitType,
    ],
  );
};

export const createSubfolderFromAccess = async (
  token: string,
  input: CreateSubfolderInput,
) => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const accessResult = await client.query(
      ` SELECT al.id, al.event_id, al.folder_id, al.access_type, al.is_active FROM access_links al WHERE al.access_token = $1 LIMIT 1 `,
      [token],
    );
    if (!accessResult.rows.length) {
      throw new Error("Access link not found");
    }
    const access = accessResult.rows[0];
    if (!access.is_active) {
      throw new Error("Access link inactive");
    }
    if (access.access_type !== "event_dashboard") {
      throw new Error("Access denied");
    }
    const subfolderResult = await client.query(
      ` INSERT INTO folders ( event_id, parent_id, name, folder_type ) VALUES ($1, $2, $3, $4) RETURNING id, name, folder_type `,
      [access.event_id, access.folder_id, input.name, "subfolder"],
    );
    const subfolder = subfolderResult.rows[0];
    const subfolderUploadToken = generateAccessToken();
    const subfolderDashboardToken = generateAccessToken();
    const subfolderUploadResult = await client.query(
      ` INSERT INTO access_links ( event_id, folder_id, access_token, access_type, label, recipient_email ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, access_token, access_type `,
      [
        access.event_id,
        subfolder.id,
        subfolderUploadToken,
        "subfolder_upload",
        "Subfolder Upload Access",
        input.recipientEmail || null,
      ],
    );
    const subfolderDashboardResult = await client.query(
      ` INSERT INTO access_links ( event_id, folder_id, access_token, access_type, label, recipient_email ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, access_token, access_type `,
      [
        access.event_id,
        subfolder.id,
        subfolderDashboardToken,
        "subfolder_dashboard",
        "Subfolder Dashboard Access",
        input.recipientEmail || null,
      ],
    );
    await client.query("COMMIT");
    return {
      subfolder,
      accessLinks: {
        subfolderUpload: subfolderUploadResult.rows[0],
        subfolderDashboard: subfolderDashboardResult.rows[0],
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
