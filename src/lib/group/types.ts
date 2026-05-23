import type { z } from "zod";
import type { GroupDirSchema, GroupSpecSchema } from "./schemas";

export type GroupDir = z.infer<typeof GroupDirSchema>;
export type GroupSpec = z.infer<typeof GroupSpecSchema>;
