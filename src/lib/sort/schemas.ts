import { z } from "zod";

export const SortDirSchema = z.enum(["asc", "desc"]);

export const SortSpecSchema = z
  .object({
    key: z.string().regex(/^[a-zA-Z0-9_]+$/),
    dir: SortDirSchema,
  })
  .strict();
