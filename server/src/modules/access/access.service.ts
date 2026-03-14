import { db } from "../../config/db";
import { cloudinary } from "../../config/cloudinary";
import { generateAccessToken } from "../../utils/token";
import { CreateSubfolderInput } from "./access.schema";
type AccessType =
  | "event_dashboard"
  | "global_upload"
  | "subfolder_upload"
  | "subfolder_dashboard";
type ResolveAccessResult = {
  accessLink: {
    id: string;
    access_type: AccessType;
    label: string | null;
    event_id: string;
    folder_id: string | null;
    is_active: boolean;
  };
  event: {
    id: string;
    title: string;
    slug: string;
    client_name: string | null;
    client_email: string;
    description: string | null;
    event_date: string | null;
    cover_image_url: string | null;
  };
  folder: {
    id: string;
    name: string;
    folder_type: "global" | "subfolder";
    parent_id: string | null;
  } | null;
};
type LogAccessVisitInput = {
  accessLinkId: string;
  eventId: string;
  folderId?: string | null;
  visitorKey?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
  referer?: string | null;
  visitType:
    | "open"
    | "dashboard_view"
    | "upload_page_view"
    | "upload_success"
    | "download"
    | "delete_subfolder";
};
type CloudinaryUploadResult = {
  secure_url: string;
  bytes: number;
  format?: string;
  width?: number;
  height?: number;
};
export const resolveAccessToken = async (
  token: string,
): Promise<ResolveAccessResult | null> => {
  const result = await db.query<{
    access_link_id: string;
    access_type: AccessType;
    label: string | null;
    event_id: string;
    linked_folder_id: string | null;
    is_active: boolean;
    event_title: string;
    event_slug: string;
    client_name: string | null;
    client_email: string;
    event_description: string | null;
    event_date: string | null;
    cover_image_url: string | null;
    folder_id: string | null;
    folder_name: string | null;
    folder_type: "global" | "subfolder" | null;
    parent_id: string | null;
  }>(
    ` SELECT al.id AS access_link_id, al.access_type, al.label, al.event_id, al.folder_id AS linked_folder_id, al.is_active, e.title AS event_title, e.slug AS event_slug, e.client_name, e.client_email, e.description AS event_description, e.event_date::text, e.cover_image_url, f.id AS folder_id, f.name AS folder_name, f.folder_type, f.parent_id FROM access_links al INNER JOIN events e ON e.id = al.event_id LEFT JOIN folders f ON f.id = al.folder_id WHERE al.access_token = $1 LIMIT 1 `,
    [token],
  );
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows[0];
  return {
    accessLink: {
      id: row.access_link_id,
      access_type: row.access_type,
      label: row.label,
      event_id: row.event_id,
      folder_id: row.linked_folder_id,
      is_active: row.is_active,
    },
    event: {
      id: row.event_id,
      title: row.event_title,
      slug: row.event_slug,
      client_name: row.client_name,
      client_email: row.client_email,
      description: row.event_description,
      event_date: row.event_date,
      cover_image_url: row.cover_image_url,
    },
    folder: row.folder_id
      ? {
          id: row.folder_id,
          name: row.folder_name as string,
          folder_type: row.folder_type as "global" | "subfolder",
          parent_id: row.parent_id,
        }
      : null,
  };
};
export const logAccessVisit = async (
  input: LogAccessVisitInput,
): Promise<void> => {
  await db.query(
    ` INSERT INTO access_link_visits ( access_link_id, event_id, folder_id, visitor_key, ip_hash, user_agent, referer, visit_type ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) `,
    [
      input.accessLinkId,
      input.eventId,
      input.folderId || null,
      input.visitorKey || null,
      input.ipHash || null,
      input.userAgent || null,
      input.referer || null,
      input.visitType,
    ],
  );
};
const uploadBufferToCloudinary = (
  fileBuffer: Buffer,
  folder: string,
  resourceType: "image" | "video",
): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Cloudinary upload failed"));
          return;
        }
        resolve({
          secure_url: result.secure_url,
          bytes: result.bytes,
          format: result.format,
          width: result.width,
          height: result.height,
        });
      },
    );
    stream.end(fileBuffer);
  });
};
export const createSubfolderFromAccess = async (
  token: string,
  input: CreateSubfolderInput,
) => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const accessResult = await client.query<{
      id: string;
      event_id: string;
      folder_id: string;
      access_type: string;
      is_active: boolean;
    }>(
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
    const subfolderResult = await client.query<{
      id: string;
      name: string;
      folder_type: string;
    }>(
      ` INSERT INTO folders ( event_id, parent_id, name, folder_type ) VALUES ($1, $2, $3, $4) RETURNING id, name, folder_type `,
      [access.event_id, access.folder_id, input.name, "subfolder"],
    );
    const subfolder = subfolderResult.rows[0];
    const subfolderUploadToken = generateAccessToken();
    const subfolderDashboardToken = generateAccessToken();
    const subfolderUploadResult = await client.query<{
      id: string;
      access_token: string;
      access_type: string;
    }>(
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
    const subfolderDashboardResult = await client.query<{
      id: string;
      access_token: string;
      access_type: string;
    }>(
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
export const uploadMediaFromAccess = async (input: {
  token: string;
  file: Express.Multer.File;
}) => {
  const access = await resolveAccessToken(input.token);
  if (!access) {
    throw new Error("Access link not found");
  }
  if (!access.accessLink.is_active) {
    throw new Error("Access link inactive");
  }
  const accessType = access.accessLink.access_type;
  const eventId = access.event.id;
  const folderId = access.folder?.id;
  if (!folderId) {
    throw new Error("Folder not found for this access link");
  }
  const mimeType = input.file.mimetype;
  const isImage = mimeType.startsWith("image/");
  const isVideo = mimeType.startsWith("video/");
  if (accessType === "global_upload" && !isImage) {
    throw new Error("Global upload allows images only");
  }
  if (accessType === "subfolder_upload" && !isImage && !isVideo) {
    throw new Error("Subfolder upload allows images or videos only");
  }
  if (accessType !== "global_upload" && accessType !== "subfolder_upload") {
    throw new Error("This access link cannot upload files");
  }
  const resourceType: "image" | "video" = isVideo ? "video" : "image";
  const uploadResult = await uploadBufferToCloudinary(
    input.file.buffer,
    `momentia/${eventId}/${folderId}`,
    resourceType,
  );
  const mediaType = isVideo ? "video" : "image";
  const inserted = await db.query<{
    id: string;
    file_name: string;
    original_url: string;
    mime_type: string;
    file_size: string;
    width: number | null;
    height: number | null;
    media_type: "image" | "video";
    folder_id: string;
    event_id: string;
  }>(
    ` INSERT INTO media ( event_id, folder_id, file_name, original_url, thumbnail_url, mime_type, file_size, width, height, media_type ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, file_name, original_url, mime_type, file_size, width, height, media_type, folder_id, event_id `,
    [
      eventId,
      folderId,
      input.file.originalname,
      uploadResult.secure_url,
      null,
      mimeType,
      input.file.size,
      uploadResult.width || null,
      uploadResult.height || null,
      mediaType,
    ],
  );
  await logAccessVisit({
    accessLinkId: access.accessLink.id,
    eventId,
    folderId,
    visitType: "upload_success",
  });
  return inserted.rows[0];
};
