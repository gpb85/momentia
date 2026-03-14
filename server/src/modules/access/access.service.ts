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

/**Επόμενο βήμα: **Create Subfolder** Τι θέλουμε να γίνει: Όταν ο client είναι μέσα στο **event dashboard** και πατάει **Create subfolder**: 1. να δημιουργείται το subfolder 2. να δημιουργείται ένα QR για **upload media** 3. να δημιουργείται ένα QR για **subfolder dashboard** 4. να επιστρέφονται τα 2 links --- # Τι θα φτιάξουμε τώρα Θα προσθέσουμε ένα νέο endpoint: ```http POST /api/access/:token/subfolders ``` Αυτό θα δουλεύει **μόνο** αν το token είναι `event_dashboard`. --- # Τι θα στέλνεις Παράδειγμα request: ```json { "name": "Friends of Groom", "recipientEmail": "friend@example.com" } ``` --- # Τι θα παίρνεις πίσω Κάτι σαν: ```json { "message": "Subfolder created successfully", "data": { "subfolder": { "id": "...", "name": "Friends of Groom", "folder_type": "subfolder" }, "accessLinks": { "subfolderUpload": { "token": "...", "url": "..." }, "subfolderDashboard": { "token": "...", "url": "..." } } } } ``` --- # Τώρα κάνε αυτά τα αρχεία ## 1. `src/modules/access/access.schema.ts` ```ts import { z } from "zod"; export const createSubfolderSchema = z.object({ name: z.string().min(2).max(120), recipientEmail: z.email().max(160).optional(), }); export type CreateSubfolderInput = z.infer<typeof createSubfolderSchema>; ``` --- ## 2. πρόσθεσε στο `src/modules/access/access.service.ts` Βάλε αυτό **κάτω από τα άλλα functions**: ```ts import { generateAccessToken } from "../../utils/token"; import { CreateSubfolderInput } from "./access.schema"; ``` και μετά πρόσθεσε αυτό το function: ```ts export const createSubfolderFromAccess = async ( token: string, input: CreateSubfolderInput ) => { const client = await db.connect(); try { await client.query("BEGIN"); const accessResult = await client.query( ` SELECT al.id, al.event_id, al.folder_id, al.access_type, al.is_active FROM access_links al WHERE al.access_token = $1 LIMIT 1 `, [token] ); if (!accessResult.rows.length) { throw new Error("Access link not found"); } const access = accessResult.rows[0]; if (!access.is_active) { throw new Error("Access link inactive"); } if (access.access_type !== "event_dashboard") { throw new Error("Access denied"); } const subfolderResult = await client.query( ` INSERT INTO folders ( event_id, parent_id, name, folder_type ) VALUES ($1, $2, $3, $4) RETURNING id, name, folder_type `, [access.event_id, access.folder_id, input.name, "subfolder"] ); const subfolder = subfolderResult.rows[0]; const subfolderUploadToken = generateAccessToken(); const subfolderDashboardToken = generateAccessToken(); const subfolderUploadResult = await client.query( ` INSERT INTO access_links ( event_id, folder_id, access_token, access_type, label, recipient_email ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, access_token, access_type `, [ access.event_id, subfolder.id, subfolderUploadToken, "subfolder_upload", "Subfolder Upload Access", input.recipientEmail || null, ] ); const subfolderDashboardResult = await client.query( ` INSERT INTO access_links ( event_id, folder_id, access_token, access_type, label, recipient_email ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, access_token, access_type `, [ access.event_id, subfolder.id, subfolderDashboardToken, "subfolder_dashboard", "Subfolder Dashboard Access", input.recipientEmail || null, ] ); await client.query("COMMIT"); return { subfolder, accessLinks: { subfolderUpload: subfolderUploadResult.rows[0], subfolderDashboard: subfolderDashboardResult.rows[0], }, }; } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); } }; ``` --- ## 3. στο `src/modules/access/access.controller.ts` πρόσθεσε imports: ```ts import { createSubfolderSchema } from "./access.schema"; import { createSubfolderFromAccess } from "./access.service"; import { env } from "../../config/env"; ``` και μετά πρόσθεσε **αυτό το νέο controller** κάτω από το προηγούμενο: ```ts export const createSubfolderByToken = async (req: Request, res: Response) => { const { token } = req.params; const parsed = createSubfolderSchema.safeParse(req.body); if (!parsed.success) { return res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten(), }); } const result = await createSubfolderFromAccess(token, parsed.data); const baseUrl = env.APP_BASE_URL || `http://localhost:${env.PORT}`; res.status(201).json({ message: "Subfolder created successfully", data: { subfolder: result.subfolder, accessLinks: { subfolderUpload: { ...result.accessLinks.subfolderUpload, url: `${baseUrl}/api/access/${result.accessLinks.subfolderUpload.access_token}`, }, subfolderDashboard: { ...result.accessLinks.subfolderDashboard, url: `${baseUrl}/api/access/${result.accessLinks.subfolderDashboard.access_token}`, }, }, }, }); }; ``` --- ## 4. στο `src/modules/access/access.routes.ts` κάν’ το έτσι: ```ts import { Router } from "express"; import { createSubfolderByToken, getAccessByToken, } from "./access.controller"; const router = Router(); router.get("/:token", getAccessByToken); router.post("/:token/subfolders", createSubfolderByToken); export default router; ``` --- # Πώς θα το δοκιμάσεις ### Request ```http POST http://localhost:5000/api/access/TO_EVENT_DASHBOARD_TOKEN/subfolders Content-Type: application/json ``` ### Body ```json { "name": "Friends of Groom", "recipientEmail": "friend@example.com" } ``` --- # Τι θέλω από σένα μετά Στείλε μου το response που θα πάρεις. Μετά θα κάνουμε το επόμενο: **να αναγνωρίζει το `/api/access/:token` και για `subfolder_upload` και για `subfolder_dashboard`.** */
