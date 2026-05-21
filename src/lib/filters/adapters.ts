import { PIVOT_FIELDS } from "@/lib/reports/pivot-fields";
import type { BaseEntity } from "@/lib/reports/types";
import type { Property } from "@/lib/properties/types";
import type { FieldDescriptor, RelationEntity } from "./descriptor";
import type { FilterDataType, FilterOp } from "./types";

const RELATION_ENTITY_MAP: Record<string, RelationEntity> = {
  customer: "customer",
  "team-member": "team_member",
  survey: "survey",
  ticket: "ticket",
};

/** Convert PivotField[] (reports) → FieldDescriptor[] (FilterRow input). */
export function pivotFieldsToDescriptors(base: BaseEntity): FieldDescriptor[] {
  return PIVOT_FIELDS[base]
    .filter((f) => f.filterOps.length > 0)
    .map((f) => ({
      id: f.id,
      label: f.label,
      group: f.group,
      dataType: f.dataType as FilterDataType,
      ops: f.filterOps as readonly FilterOp[],
      enumValues: f.enumValues ? [...f.enumValues] : undefined,
      entity: f.entity ? RELATION_ENTITY_MAP[f.entity] : undefined,
    }));
}

/** Convert Property<T>[] (list pages) → FieldDescriptor[]. Only properties
 *  with a `filter` block are included. */
export function propertiesToDescriptors<T>(
  properties: Property<T>[],
): FieldDescriptor[] {
  const out: FieldDescriptor[] = [];
  for (const p of properties) {
    if (!p.filter) continue;
    out.push({
      id: p.id,
      label: p.label,
      group: p.group,
      dataType: p.filter.dataType,
      ops: p.filter.ops,
      enumValues: p.filter.enumValues,
    });
  }
  return out;
}
