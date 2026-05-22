import { z } from "zod";

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

const SortSpecSchema = z
  .object({
    key: z.string().regex(/^[a-zA-Z0-9_]+$/),
    dir: z.enum(["asc", "desc"]),
  })
  .strict();

const GroupSpecSchema = z
  .object({
    propertyId: z.string().min(1),
    dir: z.enum(["asc", "desc"]),
  })
  .strict();

const RelativeValueSchema = z
  .object({
    n: z.number(),
    unit: z.enum(["days", "weeks", "months"]),
    dir: z.enum(["past", "next", "this"]),
  })
  .strict();

const FilterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.array(z.number()),
  z.tuple([z.number(), z.number()]),
  z.tuple([z.string(), z.string()]),
  RelativeValueSchema,
  z.null(),
]);

const FilterSchema = z
  .object({
    propertyId: z.string().min(1),
    op: z.enum([
      "eq",
      "neq",
      "lt",
      "lte",
      "gt",
      "gte",
      "between",
      "in",
      "not-in",
      "contains",
      "starts-with",
      "relative",
      "isnull",
      "notnull",
    ]),
    value: FilterValueSchema.optional(),
  })
  .strict();

const ColumnStateSchema = z
  .object({
    visibility: z.record(z.string(), z.boolean()),
    order: z.array(z.string()),
    widths: z.record(z.string(), z.number()),
  })
  .strict();

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
