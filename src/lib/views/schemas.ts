import { z } from "zod";
import { FilterSchema } from "@/lib/filters/schemas";
import { GroupSpecSchema } from "@/lib/group/schemas";
import { ColumnStateSchema } from "@/lib/properties/schemas";
import { SortSpecSchema } from "@/lib/sort/schemas";

/** Source of truth for the four entity kinds Simplesat surfaces as list pages
 *  with saved views. EntityKey is derived via z.infer below — adding a new
 *  entity is a single edit here. */
export const EntitySchema = z.enum([
  "tickets",
  "customers",
  "responses",
  "team-members",
]);
export type EntityKey = z.infer<typeof EntitySchema>;
export const ENTITY_KEYS: readonly EntityKey[] = EntitySchema.options;

export const ViewIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/);

export const ViewNameSchema = z.string().trim().min(1).max(120);

export const ViewStateSchema = z
  .object({
    sorts: z.array(SortSpecSchema),
    group: GroupSpecSchema.nullable(),
    filters: z.array(FilterSchema),
    layout: z.string().nullable(),
    columns: ColumnStateSchema.optional(),
  })
  .strict();

export const SavedViewSchema = z
  .object({
    id: ViewIdSchema,
    name: ViewNameSchema,
    state: ViewStateSchema,
    position: z.number().int().min(0).optional(),
  })
  .strict();

export const CreateInputSchema = z
  .object({
    entity: EntitySchema,
    view: SavedViewSchema,
  })
  .strict();

export const UpdateInputSchema = z
  .object({
    entity: EntitySchema,
    id: ViewIdSchema,
    state: ViewStateSchema,
  })
  .strict();

export const RenameInputSchema = z
  .object({
    entity: EntitySchema,
    id: ViewIdSchema,
    name: ViewNameSchema,
  })
  .strict();

export const DeleteInputSchema = z
  .object({
    entity: EntitySchema,
    id: ViewIdSchema,
  })
  .strict();

export const ReplaceAllInputSchema = z
  .object({
    entity: EntitySchema,
    views: z.array(SavedViewSchema),
  })
  .strict();

export const ReorderInputSchema = z
  .object({
    entity: EntitySchema,
    ids: z.array(ViewIdSchema).min(1).max(200),
  })
  .strict();
