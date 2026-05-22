import "server-only";
import { schema } from "@/db/client";
import {
  DATE_OPS,
  NUMERIC_OPS,
  STRING_OPS,
} from "@/lib/filters/types";
import type { ListFilterFieldMap } from "../compile-list";

export const RESPONSE_FILTER_FIELDS: ListFilterFieldMap = {
  rating: {
    id: "rating",
    dataType: "number",
    ops: NUMERIC_OPS,
    column: schema.responses.rating,
  },
  comment: {
    id: "comment",
    dataType: "string",
    ops: STRING_OPS,
    column: schema.responses.comment,
  },
  responded_at: {
    id: "responded_at",
    dataType: "date",
    ops: DATE_OPS,
    column: schema.responses.respondedAt,
  },
};
