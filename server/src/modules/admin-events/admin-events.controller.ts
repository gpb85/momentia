import { Request, Response } from "express";
import { createEventBox } from "./admin-events.service";
import { env } from "../../config/env";

export const createAdminEvent = async (req: Request, res: Response) => {
  const result = await createEventBox(req.body);

  const baseUrl = env.APP_BASE_URL || `http://localhost:${env.PORT}`;

  res.status(201).json({
    message: "Event box created successfully",
    data: {
      event: result.event,
      globalFolder: result.globalFolder,
      accessLinks: {
        eventDashboard: {
          ...result.accessLinks.eventDashboard,
          url: `${baseUrl}/access/${result.accessLinks.eventDashboard.token}`,
        },
        globalUpload: {
          ...result.accessLinks.globalUpload,
          url: `${baseUrl}/access/${result.accessLinks.globalUpload.token}`,
        },
      },
    },
  });
};
