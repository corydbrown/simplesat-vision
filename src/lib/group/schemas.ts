import { z } from "zod";

export const GroupDirSchema = z.enum(["asc", "desc"]);

export const GroupSpecSchema = z
  .object({
    propertyId: z.string().min(1),
    dir: GroupDirSchema,
  })
  .strict();
