import { sql, type SQL } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { compileListFilters, type ListFilterFieldMap } from "./compile-list";
import type { Filter } from "./types";

const dialect = new SQLiteSyncDialect();

function render(s: SQL | undefined): { sql: string; params: unknown[] } {
  if (!s) return { sql: "", params: [] };
  const q = dialect.sqlToQuery(s);
  return { sql: q.sql, params: q.params };
}

const FIELDS: ListFilterFieldMap = {
  subject: {
    id: "subject",
    dataType: "string",
    ops: ["contains", "eq", "neq", "isnull", "notnull"],
    column: sql`tickets.subject` as unknown as never,
  },
  createdAt: {
    id: "createdAt",
    dataType: "date",
    ops: ["eq", "neq", "lt", "gt", "between", "relative"],
    column: sql`tickets.created_at` as unknown as never,
  },
  status: {
    id: "status",
    dataType: "enum",
    ops: ["in", "not-in"],
    column: sql`tickets.status` as unknown as never,
  },
  tags: {
    id: "tags",
    dataType: "multi_enum",
    ops: ["contains-any", "contains-all", "excludes-all", "excludes-any"],
    column: sql`tickets.tags` as unknown as never,
  },
  age: {
    id: "age",
    dataType: "number",
    ops: ["eq", "between"],
    column: sql`customers.age` as unknown as never,
  },
};

describe("compileListFilters", () => {
  it("date eq compiles to a BETWEEN over the [day-start, day-end] window", () => {
    const filters: Filter[] = [
      { propertyId: "createdAt", op: "eq", value: "2026-05-15" },
    ];
    const { sql: out, params } = render(compileListFilters(filters, FIELDS));
    expect(out.toLowerCase()).toContain("between");
    // Both bounds are bound parameters, not inline literals.
    expect(params.length).toBe(2);
  });

  it("date neq compiles to an inverted OR window (< start OR > end)", () => {
    const filters: Filter[] = [
      { propertyId: "createdAt", op: "neq", value: "2026-05-15" },
    ];
    const { sql: out } = render(compileListFilters(filters, FIELDS));
    expect(out).toMatch(/<.*\s+or\s+.*>/i);
  });

  it("date relative delegates to relativeRangeMs and emits BETWEEN bounds", () => {
    const filters: Filter[] = [
      {
        propertyId: "createdAt",
        op: "relative",
        value: { n: 7, unit: "days", dir: "past" },
      },
    ];
    const { sql: out, params } = render(compileListFilters(filters, FIELDS));
    expect(out.toLowerCase()).toContain("between");
    expect(params.length).toBe(2);
  });

  it("multi_enum: contains-any → EXISTS / IN; contains-all → AND-of-EXISTS; excludes-all → NOT EXISTS", () => {
    const any = render(
      compileListFilters(
        [
          {
            propertyId: "tags",
            op: "contains-any",
            value: ["billing", "refund"],
          },
        ],
        FIELDS,
      ),
    );
    expect(any.sql.toLowerCase()).toContain("exists");
    expect(any.sql.toLowerCase()).toContain(" in (");

    const all = render(
      compileListFilters(
        [
          {
            propertyId: "tags",
            op: "contains-all",
            value: ["billing", "refund"],
          },
        ],
        FIELDS,
      ),
    );
    expect((all.sql.toLowerCase().match(/exists/g) ?? []).length).toBe(2);
    expect(all.sql.toLowerCase()).toContain(" and ");

    const not = render(
      compileListFilters(
        [{ propertyId: "tags", op: "excludes-all", value: ["billing"] }],
        FIELDS,
      ),
    );
    expect(not.sql.toLowerCase()).toContain("not exists");
  });

  it("empty enum / between value arrays drop the filter row silently", () => {
    const both = compileListFilters(
      [
        { propertyId: "status", op: "in", value: [] },
        { propertyId: "tags", op: "contains-any", value: [] },
        { propertyId: "age", op: "between", value: [1, 5] as never },
      ],
      FIELDS,
    );
    // Only the `age between` filter remains.
    const { sql: out, params } = render(both);
    expect(out.toLowerCase()).toContain("between");
    expect(params).toEqual([1, 5]);
  });

  it("AND/OR combinator chains evaluate left-to-right associatively", () => {
    const filters: Filter[] = [
      { propertyId: "subject", op: "contains", value: "refund" },
      {
        propertyId: "subject",
        op: "contains",
        value: "delay",
        combinator: "OR",
      },
      { propertyId: "status", op: "in", value: ["open", "pending"] },
      // combinator absent → defaults to AND.
    ];
    const { sql: out } = render(compileListFilters(filters, FIELDS));
    expect(out.toLowerCase()).toContain(" or ");
    expect(out.toLowerCase()).toContain(" and ");
  });

  it("filters with unknown propertyId or whitelisted-but-disallowed ops are dropped", () => {
    const result = compileListFilters(
      [
        { propertyId: "no-such-field", op: "eq", value: "x" },
        // `subject` doesn't whitelist "gt".
        { propertyId: "subject", op: "gt", value: "x" },
      ],
      FIELDS,
    );
    expect(result).toBeUndefined();
  });

  it("between requires a 2-element value array; anything else drops", () => {
    const oneEl = compileListFilters(
      [{ propertyId: "age", op: "between", value: [10] as never }],
      FIELDS,
    );
    expect(oneEl).toBeUndefined();

    const ok = compileListFilters(
      [{ propertyId: "age", op: "between", value: [10, 20] as never }],
      FIELDS,
    );
    const { sql: out, params } = render(ok);
    expect(out.toLowerCase()).toContain("between");
    expect(params).toEqual([10, 20]);
  });
});
