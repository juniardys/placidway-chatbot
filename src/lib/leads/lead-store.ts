import { z } from "zod";
import { isSessionId } from "../chat/session-store";

export const leadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  message: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => value || undefined),
  sessionId: z
    .string()
    .optional()
    .refine((value) => value === undefined || isSessionId(value)),
});

export type Lead = z.output<typeof leadSchema>;

export type LeadStoreClient = { from: (table: string) => any };

export function createLeadStore(client: LeadStoreClient) {
  return {
    async saveLead(lead: Lead): Promise<void> {
      const { error } = await client.from("leads").insert({
        name: lead.name,
        email: lead.email,
        message: lead.message ?? null,
        session_id: lead.sessionId ?? null,
      });
      if (error) throw new Error(`Lead save failed: ${error.message}`);
    },
  };
}
