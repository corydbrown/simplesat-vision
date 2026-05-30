"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  ChevronDown,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar } from "@/components/shared/avatar";
import { GroupHeading } from "@/components/shared/group-heading";
import {
  MultiSelectInput,
  MultiSelectPill,
} from "@/components/shared/multi-select-input";
import type { FieldDescriptor, RelationEntity } from "@/lib/filters/descriptor";
import {
  getMultiEnumLabel,
  useMultiEnumOptions,
} from "@/lib/filters/multi-enum-cache";
import {
  primeRelationLabel,
  useRelationLabel,
} from "@/lib/filters/relation-cache";
import {
  searchRelationOptions,
  type RelationOption,
} from "@/lib/filters/relation-options";
import {
  defaultOpFor,
  defaultValueFor,
  isFilterActive,
  isRelativeValue,
  opLabel,
  opNeedsValue,
  type Filter,
  type FilterCombinator,
  type FilterOp,
  type FilterValue,
  type RelativeDir,
  type RelativeUnit,
  type RelativeValue,
} from "@/lib/filters/types";
import { colorFromName, dicebearUrl, initialsFromName } from "@/lib/color-from-name";
import { cn } from "@/lib/utils";

/** Tailwind utility to strip the native number-input arrow buttons. */
const NO_SPINNERS =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

type FilterRowProps = {
  fields: FieldDescriptor[];
  filters: Filter[];
  onChange: (next: Filter[]) => void;
  /** Reports passes "filters" here so dnd-kit's drop zone matches the existing
   *  `overAxis === "filters"` branch in report-builder.tsx. List pages omit. */
  droppableId?: string;
  className?: string;
  /** Whether to render the AND/OR combinator toggle between rows. List pages
   *  default true (the list-filter compiler honours combinators per SVP-80).
   *  Reports pass false — the reports compiler AND's filters unconditionally,
   *  so showing the toggle there would be misleading. */
  supportCombinator?: boolean;
};

export function FilterRow({
  fields,
  filters,
  onChange,
  droppableId,
  className,
  supportCombinator = true,
}: FilterRowProps) {
  const [autoOpenIndex, setAutoOpenIndex] = useState<number | null>(null);

  const updateAt = (i: number, next: Filter) => {
    const arr = [...filters];
    arr[i] = next;
    onChange(arr);
  };
  const setCombinatorAt = (i: number, combinator: FilterCombinator) => {
    if (i <= 0) return;
    const arr = [...filters];
    const current = arr[i];
    // Only persist "OR"; AND is the default so we omit the key to keep the
    // URL-encoded and saved-view canonical forms compact.
    if (combinator === "OR") {
      arr[i] = { ...current, combinator: "OR" };
    } else {
      const next: Filter = { ...current };
      delete next.combinator;
      arr[i] = next;
    }
    onChange(arr);
  };
  const removeAt = (i: number) => {
    // Removing a row shouldn't leave the new first row carrying a leftover
    // `combinator` (combinators only matter for rows at index > 0). The fold
    // in compileListFilters ignores the first-row combinator at compile time,
    // but persisting it produces non-canonical URL/saved-view state that
    // would silently re-activate if insert-before is ever added to the UI.
    // Strip on remove to keep the canonical form clean.
    const next = filters.filter((_, idx) => idx !== i);
    if (next.length > 0 && next[0].combinator) {
      const head = { ...next[0] };
      delete head.combinator;
      next[0] = head;
    }
    onChange(next);
    if (autoOpenIndex === i) setAutoOpenIndex(null);
  };
  const add = (filter: Filter) => {
    onChange([...filters, filter]);
    setAutoOpenIndex(filters.length);
  };

  return (
    <FilterRowDroppable id={droppableId} className={className}>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {filters.map((f, i) => (
          <Fragment key={`${f.propertyId}-${i}`}>
            {supportCombinator && i > 0 && (
              <CombinatorToggle
                combinator={f.combinator ?? "AND"}
                onChange={(next) => setCombinatorAt(i, next)}
              />
            )}
            <FilterChip
              filter={f}
              fields={fields}
              autoOpen={autoOpenIndex === i}
              onAutoOpenConsumed={() => setAutoOpenIndex(null)}
              onUpdate={(next) => updateAt(i, next)}
              onDelete={() => removeAt(i)}
            />
          </Fragment>
        ))}
        <FilterAddTrigger fields={fields} onAdd={add} />
      </div>
    </FilterRowDroppable>
  );
}

FilterRow.Chip = FilterChip;
FilterRow.Add = FilterAddTrigger;

function FilterRowDroppable({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (id) {
    return (
      <FilterRowDroppableInner id={id} className={className}>
        {children}
      </FilterRowDroppableInner>
    );
  }
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

function FilterRowDroppableInner({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id, data: { axis: id } });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
        isOver ? "bg-primary/10 ring-1 ring-primary" : "",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chip — click to edit. No X button; delete lives in the editor's kebab menu.
// ---------------------------------------------------------------------------

function FilterChip({
  filter,
  fields,
  autoOpen,
  onAutoOpenConsumed,
  onUpdate,
  onDelete,
}: {
  filter: Filter;
  fields: FieldDescriptor[];
  autoOpen?: boolean;
  onAutoOpenConsumed?: () => void;
  onUpdate: (next: Filter) => void;
  onDelete: () => void;
}) {
  const field = fields.find((f) => f.id === filter.propertyId);
  const [open, setOpen] = useState(autoOpen ?? false);

  // Honour `autoOpen` (set by the parent after adding a new chip). Open
  // once on the first render where autoOpen=true, then tell the parent so
  // it can clear its marker.
  useEffect(() => {
    if (!autoOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
    onAutoOpenConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  if (!field) {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-sm h-8 text-muted-foreground">
        Unknown field
        <button
          type="button"
          onClick={onDelete}
          aria-label="Remove filter"
          className="ml-0.5 rounded p-0.5 hover:bg-accent hover:text-foreground cursor-pointer"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  const active = isFilterActive(filter);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm h-8 cursor-pointer outline-none transition-colors",
            active
              ? "border-transparent bg-blue-lighter text-blue-darker"
              : "border-border bg-card text-foreground hover:border-foreground/20",
          )}
        >
          <span>{field.label}</span>
          {active && (
            <>
              <span className="text-blue-dark">
                {opLabel(filter.op, field.dataType)}
              </span>
              <ValueLabel filter={filter} field={field} />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <FilterEditor
          field={field}
          filter={filter}
          onUpdate={onUpdate}
          onDelete={() => {
            onDelete();
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Chip value label (right-hand "value" portion of the chip)
// ---------------------------------------------------------------------------

function ValueLabel({
  filter,
  field,
}: {
  filter: Filter;
  field: FieldDescriptor;
}) {
  if (!opNeedsValue(filter.op)) return null;
  const v = filter.value;

  // Relation single: avatar + name
  if (field.entity && typeof v === "string") {
    if (!v) return <Placeholder />;
    return <RelationChipSingle entity={field.entity} id={v} />;
  }
  // Relation multi
  if (field.entity && Array.isArray(v)) {
    if (v.length === 0) return <Placeholder />;
    return (
      <RelationChipMulti entity={field.entity} ids={v as string[]} />
    );
  }

  // Date relative — "last 7 days" / "this week" style.
  if (filter.op === "relative" && isRelativeValue(v)) {
    let text: string;
    if (v.dir === "this") {
      const unitSingular = v.unit.replace(/s$/, "");
      text = `this ${unitSingular}`;
    } else {
      text = `${v.dir === "past" ? "last" : "next"} ${v.n} ${v.unit}`;
    }
    return <span className="max-w-[20ch] truncate">{text}</span>;
  }
  // Between range
  if (filter.op === "between" && Array.isArray(v) && v.length === 2) {
    const [a, b] = v as [unknown, unknown];
    if (a == null || b == null) return <Placeholder />;
    return (
      <span className="max-w-[24ch] truncate">
        {formatScalar(a, field, filter.propertyId)}–
        {formatScalar(b, field, filter.propertyId)}
      </span>
    );
  }
  // Multi-value (enum in/not-in, multi_enum) when not relation
  if (Array.isArray(v)) {
    if (v.length === 0) return <Placeholder />;
    const labels = v.map((x) => {
      if (field.dataType === "multi_enum" && typeof x === "string") {
        return getMultiEnumLabel(field.dynamicValuesKey, x) ?? x;
      }
      return formatScalar(x, field, filter.propertyId);
    });
    return (
      <span className="max-w-[24ch] truncate">{labels.join(", ")}</span>
    );
  }
  // Empty single value
  if (v == null || v === "") return <Placeholder />;
  // Single scalar
  return (
    <span className="max-w-[20ch] truncate">
      {formatScalar(v, field, filter.propertyId)}
    </span>
  );
}

function Placeholder() {
  return <span className="text-muted-foreground italic">—</span>;
}

function RelationChipSingle({
  entity,
  id,
}: {
  entity: RelationEntity;
  id: string;
}) {
  const label = useRelationLabel(entity, id);
  const showName = label ?? id;
  const showAvatar = entity === "customer" || entity === "team_member";
  return (
    <span className="inline-flex items-center gap-1 max-w-[22ch] truncate">
      {showAvatar && label && (
        <Avatar
          bg={colorFromName(label)}
          initials={initialsFromName(label)}
          imageUrl={dicebearUrl(label)}
          size="sm"
        />
      )}
      <span className="truncate">{showName}</span>
    </span>
  );
}

function RelationChipMulti({
  entity,
  ids,
}: {
  entity: RelationEntity;
  ids: string[];
}) {
  return (
    <span className="inline-flex items-center gap-1 max-w-[28ch] truncate">
      {ids.slice(0, 3).map((id) => (
        <RelationChipSingle key={id} entity={entity} id={id} />
      ))}
      {ids.length > 3 && <span className="opacity-70">+{ids.length - 3}</span>}
    </span>
  );
}

function formatScalar(
  v: unknown,
  field: FieldDescriptor,
  propertyId: string,
): string {
  if (typeof v === "string") {
    if (field.enumValues?.includes(v)) {
      return formatEnumValue(propertyId, v);
    }
    return v;
  }
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return "";
}

// ---------------------------------------------------------------------------
// Add trigger — two-stage popover (pick field → edit just-added chip).
// ---------------------------------------------------------------------------

function FilterAddTrigger({
  fields,
  onAdd,
}: {
  fields: FieldDescriptor[];
  onAdd: (filter: Filter) => void;
}) {
  const [open, setOpen] = useState(false);

  const pickField = (id: string) => {
    const field = fields.find((f) => f.id === id);
    if (!field) return;
    const op = field.ops.includes(defaultOpFor(field.dataType))
      ? defaultOpFor(field.dataType)
      : field.ops[0];
    const filter: Filter = { propertyId: id, op };
    const dv = defaultValueFor(op);
    // Skip default scalar zeros — leave the value blank so the user is
    // prompted to fill it in via the chip's editor.
    if (
      op === "between" ||
      op === "in" ||
      op === "not-in" ||
      op === "relative" ||
      op === "contains-any" ||
      op === "contains-all" ||
      op === "excludes-any" ||
      op === "excludes-all"
    ) {
      filter.value = dv;
    } else if (op === "isnull" || op === "notnull") {
      // no value
    } else {
      // eq/neq/contains/lt/lte/gt/gte etc. — leave value undefined so the
      // chip shows "—" until the user picks one.
    }
    onAdd(filter);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer h-8"
        >
          <Plus size={14} />
          Add filter
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <FieldPicker fields={fields} onPick={pickField} />
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Editor — field is locked. Op + value auto-apply. Kebab menu top-right
// holds "Delete filter".
// ---------------------------------------------------------------------------

function FilterEditor({
  field,
  filter,
  onUpdate,
  onDelete,
}: {
  field: FieldDescriptor;
  filter: Filter;
  onUpdate: (next: Filter) => void;
  onDelete: () => void;
}) {
  const setOp = (op: FilterOp) => {
    const dv = defaultValueFor(op);
    const next: Filter = { propertyId: field.id, op };
    if (op !== "isnull" && op !== "notnull" && dv !== undefined) {
      next.value = dv;
    }
    onUpdate(next);
  };

  const setValue = (next: FilterValue) => {
    if (next === undefined) {
      const out: Filter = { propertyId: field.id, op: filter.op };
      onUpdate(out);
      return;
    }
    onUpdate({ propertyId: field.id, op: filter.op, value: next });
  };

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium text-foreground px-1.5 truncate">
          {field.label}
        </span>
        <OpDropdown field={field} op={filter.op} onChange={setOp} />
        <div className="flex-1" />
        <EditorMenu onDelete={onDelete} />
      </div>
      <ValueEditor
        field={field}
        op={filter.op}
        value={filter.value}
        onChange={setValue}
      />
    </div>
  );
}

function EditorMenu({ onDelete }: { onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Filter options"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuItem
          onSelect={onDelete}
          className="cursor-pointer whitespace-nowrap hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <Trash2 size={14} />
          Delete filter
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled
          className="text-muted-foreground/60 whitespace-nowrap"
        >
          Add to advanced filter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Field picker (add flow, stage 1)
// ---------------------------------------------------------------------------

function FieldPicker({
  fields,
  onPick,
}: {
  fields: FieldDescriptor[];
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = query
    ? fields.filter((f) =>
        f.label.toLowerCase().includes(query.toLowerCase()),
      )
    : fields;

  const groups = groupBy(filtered, (f) => f.group ?? "");

  return (
    <div className="max-h-80 overflow-auto">
      <div className="sticky top-0 border-b bg-popover p-2">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search fields"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full rounded-md border border-border bg-background pl-7 pr-2 py-1.5 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1 p-2">
        {Object.keys(groups).map((group) => (
          <div key={group} className="flex flex-col gap-0.5">
            {group && (
              <GroupHeading className="px-2 py-0 pt-1">{group}</GroupHeading>
            )}
            {groups[group].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onPick(f.id)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left hover:bg-accent cursor-pointer"
              >
                <span className="text-foreground truncate">{f.label}</span>
              </button>
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-2 py-3 text-sm text-muted-foreground">
            No matching fields.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Combinator toggle (AND / OR) — appears between filter rows on list pages
// when supportCombinator is true. The first row never renders it; only rows
// at index > 0 carry a combinator describing how they join to the previous
// row's accumulated expression. See `compileListFilters` for the fold.
// ---------------------------------------------------------------------------

function CombinatorToggle({
  combinator,
  onChange,
}: {
  combinator: FilterCombinator;
  onChange: (next: FilterCombinator) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Combinator: ${combinator}. Click to change.`}
          className="flex h-8 items-center gap-1 rounded-md px-1.5 text-sm text-muted-foreground cursor-pointer hover:bg-accent hover:text-foreground"
        >
          <span className="font-medium">{combinator}</span>
          <ChevronDown size={12} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[6rem]">
        <DropdownMenuItem
          onSelect={() => onChange("AND")}
          className="cursor-pointer"
        >
          AND
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onChange("OR")}
          className="cursor-pointer"
        >
          OR
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Op dropdown
// ---------------------------------------------------------------------------

function OpDropdown({
  field,
  op,
  onChange,
}: {
  field: FieldDescriptor;
  op: FilterOp;
  onChange: (next: FilterOp) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-sm cursor-pointer hover:bg-accent"
        >
          <span className="text-muted-foreground">
            {opLabel(op, field.dataType)}
          </span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[12rem]">
        {field.ops.map((o) => (
          <DropdownMenuItem
            key={o}
            onSelect={() => onChange(o)}
            className="cursor-pointer whitespace-nowrap"
          >
            {opLabel(o, field.dataType)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Value editor (auto-apply)
// ---------------------------------------------------------------------------

function ValueEditor({
  field,
  op,
  value,
  onChange,
}: {
  field: FieldDescriptor;
  op: FilterOp;
  value: FilterValue;
  onChange: (next: FilterValue) => void;
}) {
  if (!opNeedsValue(op)) {
    return null;
  }

  // Relation typeahead (multi-select only; enum/relation no longer use eq/neq)
  if (field.entity && (op === "in" || op === "not-in")) {
    return (
      <RelationMultiInput
        entity={field.entity}
        value={Array.isArray(value) ? (value as string[]) : []}
        onChange={onChange}
      />
    );
  }

  // Multi-select on enum (or strings with known options)
  if ((op === "in" || op === "not-in") && field.enumValues?.length) {
    return (
      <EnumMultiInput
        propertyId={field.id}
        options={field.enumValues}
        value={Array.isArray(value) ? (value as string[]) : []}
        onChange={onChange}
      />
    );
  }

  // Multi-enum (JSON-array column) — checkbox popover with counts + search.
  if (
    field.dataType === "multi_enum" &&
    (op === "contains-any" ||
      op === "contains-all" ||
      op === "excludes-any" ||
      op === "excludes-all")
  ) {
    return (
      <MultiEnumInput
        field={field}
        value={Array.isArray(value) ? (value as string[]) : []}
        onChange={onChange}
      />
    );
  }

  // Boolean
  if (field.dataType === "boolean" && (op === "eq" || op === "neq")) {
    const v = typeof value === "boolean" ? value : value === "true";
    return (
      <div className="flex gap-2">
        <ToggleButton active={v} label="true" onClick={() => onChange(true)} />
        <ToggleButton
          active={!v}
          label="false"
          onClick={() => onChange(false)}
        />
      </div>
    );
  }

  // Date between → range calendar
  if (field.dataType === "date" && op === "between") {
    return <DateRangeInput value={value} onChange={onChange} />;
  }

  // Date single (lt/lte/gt/gte)
  if (field.dataType === "date") {
    return <DateSingleInput value={value} onChange={onChange} />;
  }

  // Numeric between
  if (op === "between") {
    return <NumericBetweenInput value={value} onChange={onChange} />;
  }

  // Relative date
  if (op === "relative") {
    return <RelativeDateInput value={value} onChange={onChange} />;
  }

  // Default: text or number
  return (
    <TextOrNumberInput
      dataType={field.dataType === "number" ? "number" : "string"}
      value={value}
      onChange={onChange}
    />
  );
}

function ToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-md border px-2 py-1.5 text-sm cursor-pointer",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:bg-accent",
      )}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Enum value formatting
// ---------------------------------------------------------------------------

const SURVEY_TYPE_LABELS: Record<string, string> = {
  csat: "CSAT",
  nps: "NPS",
  ces: "CES",
  five_star: "5-Star",
  custom: "Custom",
};

export function formatEnumValue(propertyId: string, value: string): string {
  if (propertyId === "survey_type" || propertyId === "survey_metric") {
    return SURVEY_TYPE_LABELS[value] ?? value;
  }
  // Generic title-case for everything else (open → Open, not_sent → Not sent)
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// ---------------------------------------------------------------------------
// Enum multi (pills-in-input)
// ---------------------------------------------------------------------------

function EnumMultiInput({
  propertyId,
  options,
  value,
  onChange,
}: {
  propertyId: string;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const remaining = options
    .filter(
      (o) =>
        !value.includes(o) &&
        (q === "" ||
          formatEnumValue(propertyId, o).toLowerCase().includes(q)),
    )
    .map((o) => ({ value: o, label: formatEnumValue(propertyId, o) }));

  return (
    <MultiSelectInput
      value={value}
      onChange={onChange}
      query={query}
      onQueryChange={setQuery}
      options={remaining}
      alwaysShowDropdown={false}
      dropdownMaxHeight="max-h-48"
      renderPill={(v, onRemove) => (
        <MultiSelectPill
          label={formatEnumValue(propertyId, v)}
          onRemove={onRemove}
        />
      )}
      renderOption={(o) => (
        <span className="text-foreground truncate flex-1">{o.label}</span>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Multi-enum (JSON-array column) — mirrors EnumMultiInput's pills-in-input
// shape; only addition is the count rendered on each remaining-option row.
// Options arrive via the dynamicValuesKey + multi-enum-cache server fetch.
// ---------------------------------------------------------------------------

function MultiEnumInput({
  field,
  value,
  onChange,
}: {
  field: FieldDescriptor;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const { options, loading } = useMultiEnumOptions(field.dynamicValuesKey);

  const q = query.trim().toLowerCase();
  const remaining = options.filter(
    (o) =>
      !value.includes(o.value) &&
      (q === "" ||
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q)),
  );

  const labelFor = (v: string) =>
    options.find((o) => o.value === v)?.label ?? v;

  return (
    <MultiSelectInput
      value={value}
      onChange={onChange}
      query={query}
      onQueryChange={setQuery}
      options={remaining}
      loading={loading}
      renderPill={(v, onRemove) => (
        <MultiSelectPill label={labelFor(v)} onRemove={onRemove} />
      )}
      renderOption={(o) => (
        <>
          <span className="text-foreground truncate flex-1">{o.label}</span>
          <span className="text-muted-foreground tabular-nums">{o.count}</span>
        </>
      )}
      renderEmpty={(isLoading) => (
        <div className="px-2 py-2 text-sm text-muted-foreground">
          {isLoading
            ? "Loading…"
            : options.length === 0
              ? "No values in use."
              : "No matches."}
        </div>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Numeric between (no "and" text, narrower inputs to fit popover)
// ---------------------------------------------------------------------------

function NumericBetweenInput({
  value,
  onChange,
}: {
  value: FilterValue;
  onChange: (next: FilterValue) => void;
}) {
  const arr = Array.isArray(value) ? value : ([undefined, undefined] as const);
  const [a, b] = arr as [unknown, unknown];
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        placeholder="Min"
        value={a == null ? "" : Number(a)}
        onChange={(e) =>
          onChange([
            e.target.value === "" ? null : Number(e.target.value),
            b,
          ] as never)
        }
        autoFocus
        className={cn(
          "w-1/2 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary",
          NO_SPINNERS,
        )}
      />
      <input
        type="number"
        placeholder="Max"
        value={b == null ? "" : Number(b)}
        onChange={(e) =>
          onChange([
            a,
            e.target.value === "" ? null : Number(e.target.value),
          ] as never)
        }
        className={cn(
          "w-1/2 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary",
          NO_SPINNERS,
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Date inputs — react-day-picker inline calendar
// ---------------------------------------------------------------------------

function parseISODate(s: unknown): Date | undefined {
  if (typeof s !== "string" || !s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}
function isoFromDate(d: Date | undefined): string {
  if (!d) return "";
  // Local-date YYYY-MM-DD so the calendar selection and the filter line up.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function formatDateLabel(s: string | undefined): string {
  const d = parseISODate(s);
  if (!d) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function DateSingleInput({
  value,
  onChange,
}: {
  value: FilterValue;
  onChange: (next: FilterValue) => void;
}) {
  const selected =
    typeof value === "string" ? parseISODate(value) : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="rounded-md border border-border bg-background px-2 py-1.5 text-sm">
        {selected ? (
          <span className="text-foreground">{formatDateLabel(value as string)}</span>
        ) : (
          <span className="text-muted-foreground">Pick a date</span>
        )}
      </div>
      <Calendar
        mode="single"
        selected={selected}
        onSelect={(d) => onChange(isoFromDate(d))}
      />
    </div>
  );
}

function DateRangeInput({
  value,
  onChange,
}: {
  value: FilterValue;
  onChange: (next: FilterValue) => void;
}) {
  const arr = Array.isArray(value) ? value : ([undefined, undefined] as const);
  const from = parseISODate((arr as [unknown, unknown])[0]);
  const to = parseISODate((arr as [unknown, unknown])[1]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm">
          {from ? (
            <span className="text-foreground">{formatDateLabel(isoFromDate(from))}</span>
          ) : (
            <span className="text-muted-foreground">Start</span>
          )}
        </div>
        <div className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm">
          {to ? (
            <span className="text-foreground">{formatDateLabel(isoFromDate(to))}</span>
          ) : (
            <span className="text-muted-foreground">End</span>
          )}
        </div>
      </div>
      <Calendar
        mode="range"
        selected={{ from, to }}
        onSelect={(range) => {
          onChange([
            isoFromDate(range?.from),
            isoFromDate(range?.to),
          ] as never);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Relative date
// ---------------------------------------------------------------------------

function RelativeDateInput({
  value,
  onChange,
}: {
  value: FilterValue;
  onChange: (next: FilterValue) => void;
}) {
  const rv: RelativeValue = isRelativeValue(value)
    ? value
    : { n: 7, unit: "days", dir: "past" };
  const isThis = rv.dir === "this";
  return (
    <div className="flex items-center gap-2">
      <select
        value={rv.dir}
        onChange={(e) =>
          onChange({ ...rv, dir: e.target.value as RelativeDir })
        }
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm cursor-pointer"
      >
        <option value="past">Last</option>
        <option value="next">Next</option>
        <option value="this">This</option>
      </select>
      {!isThis && (
        <input
          type="number"
          min={1}
          value={rv.n}
          onChange={(e) =>
            onChange({ ...rv, n: Math.max(1, Number(e.target.value || 1)) })
          }
          className={cn(
            "w-16 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary",
            NO_SPINNERS,
          )}
        />
      )}
      <select
        value={rv.unit}
        onChange={(e) =>
          onChange({ ...rv, unit: e.target.value as RelativeUnit })
        }
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm cursor-pointer flex-1"
      >
        {isThis ? (
          <>
            <option value="days">day</option>
            <option value="weeks">week</option>
            <option value="months">month</option>
          </>
        ) : (
          <>
            <option value="days">days</option>
            <option value="weeks">weeks</option>
            <option value="months">months</option>
          </>
        )}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text / number plain input
// ---------------------------------------------------------------------------

function TextOrNumberInput({
  dataType,
  value,
  onChange,
}: {
  dataType: "string" | "number";
  value: FilterValue;
  onChange: (next: FilterValue) => void;
}) {
  if (dataType === "number") {
    return (
      <input
        type="number"
        placeholder="Enter a number"
        value={
          typeof value === "number" ? value : value == null ? "" : String(value)
        }
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : Number(e.target.value))
        }
        autoFocus
        className={cn(
          "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary",
          NO_SPINNERS,
        )}
      />
    );
  }
  return (
    <input
      type="text"
      placeholder="Enter a value"
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      autoFocus
      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
    />
  );
}

// ---------------------------------------------------------------------------
// Relation typeahead — single + multi, with avatars for people-like entities
// ---------------------------------------------------------------------------

function useRelationOptions(entity: RelationEntity, query: string) {
  const [options, setOptions] = useState<RelationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const myReq = ++reqId.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const opts = await searchRelationOptions(entity, query);
        if (myReq === reqId.current) {
          for (const o of opts) primeRelationLabel(entity, o.value, o.label);
          setOptions(opts);
        }
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [entity, query]);

  return { options, loading };
}

function entityHasAvatar(entity: RelationEntity): boolean {
  return entity === "customer" || entity === "team_member";
}

function RelationMultiInput({
  entity,
  value,
  onChange,
}: {
  entity: RelationEntity;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const { options, loading } = useRelationOptions(entity, query);
  const remaining = options.filter((o) => !value.includes(o.value));

  return (
    <MultiSelectInput
      value={value}
      onChange={onChange}
      query={query}
      onQueryChange={setQuery}
      options={remaining}
      loading={loading}
      renderPill={(id, onRemove) => (
        <SelectedRelationPill entity={entity} id={id} onRemove={onRemove} />
      )}
      renderOption={(o) => (
        <>
          {entityHasAvatar(entity) && (
            <Avatar
              bg={colorFromName(o.label)}
              initials={initialsFromName(o.label)}
              imageUrl={dicebearUrl(o.label)}
              size="sm"
            />
          )}
          <span className="text-foreground truncate flex-1">{o.label}</span>
        </>
      )}
      renderEmpty={(isLoading) => (
        <div className="px-2 py-2 text-sm text-muted-foreground">
          {isLoading ? "Searching…" : "No matches."}
        </div>
      )}
    />
  );
}

function SelectedRelationPill({
  entity,
  id,
  onRemove,
}: {
  entity: RelationEntity;
  id: string;
  onRemove: () => void;
}) {
  const label = useRelationLabel(entity, id);
  const shown = label ?? id;
  return (
    <MultiSelectPill
      label={shown}
      avatar={
        entityHasAvatar(entity) && label ? (
          <Avatar
            bg={colorFromName(label)}
            initials={initialsFromName(label)}
            imageUrl={dicebearUrl(label)}
            size="sm"
          />
        ) : undefined
      }
      onRemove={onRemove}
    />
  );
}

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

function groupBy<T>(arr: T[], key: (t: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of arr) {
    const k = key(item);
    (out[k] ??= []).push(item);
  }
  return out;
}
