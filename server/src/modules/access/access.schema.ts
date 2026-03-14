import { z } from "zod";
export const createSubfolderSchema = z.object({
  name: z.string().min(2).max(120),
  recipientEmail: z.email().max(160).optional(),
});
export type CreateSubfolderInput = z.infer<typeof createSubfolderSchema>;
