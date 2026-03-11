import { z } from "zod";

export const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(2).max(200),
    clientName: z.string().min(2).max(120).optional(),
    clientEmail: z.email().max(160),
    description: z.string().max(2000).optional(),
    eventDate: z.iso.date().optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});

export type CreateEventInput = z.infer<typeof createEventSchema>["body"];
