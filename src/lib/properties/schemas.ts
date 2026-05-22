import { z } from "zod";

export const ColumnStateSchema = z
  .object({
    visibility: z.record(z.string(), z.boolean()),
    order: z.array(z.string()),
    widths: z.record(z.string(), z.number()),
  })
  .strict();
