import { z } from "zod";

export const FilterDataTypeSchema = z.enum([
  "string",
  "number",
  "date",
  "enum",
  "boolean",
  "relation",
  "multi_enum",
]);

export const FilterOpSchema = z.enum([
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
  "contains-any",
  "contains-all",
  "excludes-any",
  "excludes-all",
]);

export const RelativeUnitSchema = z.enum(["days", "weeks", "months"]);
export const RelativeDirSchema = z.enum(["past", "next", "this"]);

export const RelativeValueSchema = z
  .object({
    n: z.number(),
    unit: RelativeUnitSchema,
    dir: RelativeDirSchema,
  })
  .strict();

export const FilterValueSchema = z.union([
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

/** Combinator for "how do I combine with the previous filter row." Absent on
 *  the first row (no previous row to combine with); on subsequent rows,
 *  absent defaults to "AND" so existing saved views + URLs keep working. */
export const FilterCombinatorSchema = z.enum(["AND", "OR"]);

export const FilterSchema = z
  .object({
    propertyId: z.string().min(1),
    op: FilterOpSchema,
    value: FilterValueSchema.optional(),
    combinator: FilterCombinatorSchema.optional(),
  })
  .strict();
