import { db } from "../../config/db";
import { toSlug } from "../../utils/slug";
import { generateAccessToken } from "../../utils/token";
import { CreateEventInput } from "./admin-events.schema";

type CreateEventBoxResult = {
  event: {
    id: string;
    title: string;
    slug: string;
    client_email: string;
  };
  globalFolder: {
    id: string;
    name: string;
    folder_type: string;
  };
  accessLinks: {
    eventDashboard: {
      id: string;
      token: string;
      access_type: string;
    };
    globalUpload: {
      id: string;
      token: string;
      access_type: string;
    };
  };
};

export const createEventBox = async (
  input: CreateEventInput,
): Promise<CreateEventBoxResult> => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const baseSlug = toSlug(input.title);
    let finalSlug = baseSlug || "event-box";

    const slugCheck = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM events WHERE slug = $1`,
      [finalSlug],
    );

    if (slugCheck.rows[0].count !== "0") {
      finalSlug = `${finalSlug}-${Date.now()}`;
    }

    const eventResult = await client.query<{
      id: string;
      title: string;
      slug: string;
      client_email: string;
    }>(
      `
      INSERT INTO events (
        title,
        slug,
        client_name,
        client_email,
        description,
        event_date
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, title, slug, client_email
      `,
      [
        input.title,
        finalSlug,
        input.clientName || null,
        input.clientEmail,
        input.description || null,
        input.eventDate || null,
      ],
    );

    const event = eventResult.rows[0];

    const globalFolderResult = await client.query<{
      id: string;
      name: string;
      folder_type: string;
    }>(
      `
      INSERT INTO folders (
        event_id,
        parent_id,
        name,
        folder_type
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, folder_type
      `,
      [event.id, null, "Global Folder", "global"],
    );

    const globalFolder = globalFolderResult.rows[0];

    const eventDashboardToken = generateAccessToken();
    const globalUploadToken = generateAccessToken();

    const eventDashboardResult = await client.query<{
      id: string;
      access_token: string;
      access_type: string;
    }>(
      `
      INSERT INTO access_links (
        event_id,
        folder_id,
        access_token,
        access_type,
        label,
        recipient_email
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, access_token, access_type
      `,
      [
        event.id,
        globalFolder.id,
        eventDashboardToken,
        "event_dashboard",
        "Event Dashboard Access",
        input.clientEmail,
      ],
    );

    const globalUploadResult = await client.query<{
      id: string;
      access_token: string;
      access_type: string;
    }>(
      `
      INSERT INTO access_links (
        event_id,
        folder_id,
        access_token,
        access_type,
        label,
        recipient_email
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, access_token, access_type
      `,
      [
        event.id,
        globalFolder.id,
        globalUploadToken,
        "global_upload",
        "Global Upload Access",
        input.clientEmail,
      ],
    );

    await client.query("COMMIT");

    return {
      event,
      globalFolder,
      accessLinks: {
        eventDashboard: {
          id: eventDashboardResult.rows[0].id,
          token: eventDashboardResult.rows[0].access_token,
          access_type: eventDashboardResult.rows[0].access_type,
        },
        globalUpload: {
          id: globalUploadResult.rows[0].id,
          token: globalUploadResult.rows[0].access_token,
          access_type: globalUploadResult.rows[0].access_type,
        },
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
