"use client";

import { useDroppable } from "@dnd-kit/core";
import { ChevronDown, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
import type { FieldDescriptor } from "@/lib/filters/descriptor";
import {
  defaultOpFor,
  defaultValueFor,
  isRelativeValue,
  OP_LABEL,
  opLabel,
  opNeedsValue,
  type Filter,
  type FilterOp,
  type FilterValue,
  type RelativeDir,
  type RelativeUnit,
  type RelativeValue,
} from "@/lib/filters/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

type FilterRowProps = {
  label?: string;
  fields: FieldDescriptor[];
  filters: Filter[];
  onChange: (next: Filter[]) => void;
  /** Reports passes "filters" here so dnd-kit's drop zone matches the existing
   *  `overAxis === "filters"` branch in report-builder.tsx. List pages omit. */
  droppableId?: string;
  className?: string;
};

export function FilterRow({
  label = "Filters",
  fields,
  filters,
  onChange,
  droppableId,
  className,
}: FilterRowProps) {
  const updateAt = (i: number, next: Filter) => {
    const arr = [...filters];
    arr[i] = next;
    onChange(arr);
  };
  const removeAt = (i: number) => {
    onChange(filters.filter((_, idx) => idx !== i));
  };
  const add = (filter: Filter) => onChange([...filters, filter]);

  return (
    <FilterRowDroppable id={droppableId} className={className}>
      <span className="text-xs font-medium text-muted-foreground shrink-0">
        {label}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {filters.map((f, i) => (
          <FilterChip
            key={`${f.propertyId}-${i}`}
            filter={f}
            fields={fields}
            onChange={(next) => updateAt(i, next)}
            onRemove={() => removeAt(i)}
          />
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
    // Reports: wrap with useDroppable.
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
// Chip
// ---------------------------------------------------------------------------

function FilterChip({
  filter,
  fields,
  onChange,
  onRemove,
}: {
  filter: Filter;
  fields: FieldDescriptor[];
  onChange: (next: Filter) => void;
  onRemove: () => void;
}) {
  const field = fields.find((f) => f.id === filter.propertyId);
  const [open, setOpen] = useState(false);

  if (!field) {
    // Stale filter pointing at an unknown field — show as orphan with remove button.
    return (
      <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-sm h-8 text-muted-foreground">
        Unknown field
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove filter"
          className="ml-0.5 rounded p-0.5 hover:bg-accent hover:text-foreground cursor-pointer"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="inline-flex items-center gap-1 rounded-md border border-border bg-card pl-2 pr-1 py-1 text-sm h-8">
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 cursor-pointer outline-none"
          >
            <span className="text-foreground">{field.label}</span>
            <span className="text-muted-foreground">
              {opLabel(filter.op, field.dataType)}
            </span>
            <ValueLabel filter={filter} field={field} />
          </button>
        </PopoverTrigger>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove filter"
          className="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
        >
          <X size={12} />
        </button>
      </div>
      <PopoverContent align="start" className="w-80 p-0">
        <FilterEditor
          fields={fields}
          initial={filter}
          onApply={(next) => {
            onChange(next);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

function ValueLabel({
  filter,
  field,
}: {
  filter: Filter;
  field: FieldDescriptor;
}) {
  if (!opNeedsValue(filter.op)) return null;
  const v = filter.value;
  let text: string;
  if (filter.op === "relative" && isRelativeValue(v)) {
    text = `${v.dir === "past" ? "last" : "next"} ${v.n} ${v.unit}`;
  } else if (filter.op === "between" && Array.isArray(v) && v.length === 2) {
    text = `${formatScalar(v[0])} – ${formatScalar(v[1])}`;
  } else if (Array.isArray(v)) {
    text = v.length === 0 ? "(empty)" : v.map(formatScalar).join(", ");
  } else if (v == null || v === "") {
    text = "(empty)";
  } else {
    text = formatScalar(v);
  }
  return (
    <span
      className={cn(
        "max-w-[16ch] truncate text-foreground",
        // Enum fields' "is" with a single value reads better visually but no
        // styling diff needed today.
        field.dataType === "enum" && "",
      )}
    >
      {text}
    </span>
  );
}

function formatScalar(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return "";
}

// ---------------------------------------------------------------------------
// Add trigger
// ---------------------------------------------------------------------------

function FilterAddTrigger({
  fields,
  onAdd,
}: {
  fields: FieldDescriptor[];
  onAdd: (filter: Filter) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer h-8"
        >
          <Plus size={12} />
          Add filter
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <FilterEditor
          fields={fields}
          initial={null}
          onApply={(next) => {
            onAdd(next);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Editor — shared between add (no initial) and edit (initial = current filter)
// ---------------------------------------------------------------------------

type EditorState = {
  fieldId: string | null;
  op: FilterOp | null;
  value: FilterValue;
};

function initialEditorState(initial: Filter | null): EditorState {
  return {
    fieldId: initial?.propertyId ?? null,
    op: initial?.op ?? null,
    value: initial?.value,
  };
}

function FilterEditor({
  fields,
  initial,
  onApply,
  onCancel,
}: {
  fields: FieldDescriptor[];
  initial: Filter | null;
  onApply: (filter: Filter) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<EditorState>(() =>
    initialEditorState(initial),
  );
  const field = useMemo(
    () =>
      state.fieldId
        ? (fields.find((f) => f.id === state.fieldId) ?? null)
        : null,
    [state.fieldId, fields],
  );

  const pickField = (nextId: string) => {
    const nextField = fields.find((f) => f.id === nextId);
    if (!nextField) return;
    // Keep existing op/value only when the user re-picks the same field
    // (covers the edit flow: initial filter's field is already selected and
    // the user is just changing op or value).
    if (state.fieldId === nextId && state.op && nextField.ops.includes(state.op)) {
      return;
    }
    const nextOp = nextField.ops.includes(defaultOpFor(nextField.dataType))
      ? defaultOpFor(nextField.dataType)
      : nextField.ops[0];
    setState({
      fieldId: nextId,
      op: nextOp,
      value: defaultValueFor(nextOp),
    });
  };

  const setOpAndResetValue = (nextOp: FilterOp) => {
    setState((prev) => ({
      ...prev,
      op: nextOp,
      value: defaultValueFor(nextOp),
    }));
  };

  const setValue = (next: FilterValue) =>
    setState((prev) => ({ ...prev, value: next }));

  if (!field) {
    return <FieldPicker fields={fields} onPick={pickField} />;
  }

  const op = state.op ?? field.ops[0];
  const canApply = isValueValid(op, state.value);
  const apply = () => {
    if (!canApply) return;
    const out: Filter = { propertyId: field.id, op };
    if (opNeedsValue(op) && state.value !== undefined) out.value = state.value;
    onApply(out);
  };

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center gap-1">
        <FieldDropdown
          fields={fields}
          currentId={field.id}
          onPick={pickField}
        />
        <OpDropdown field={field} op={op} onChange={setOpAndResetValue} />
      </div>
      <ValueEditor
        field={field}
        op={op}
        value={state.value}
        onChange={setValue}
      />
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!canApply}
          onClick={apply}
          className="cursor-pointer"
        >
          Apply
        </Button>
      </div>
    </div>
  );
}

function isValueValid(op: FilterOp, value: FilterValue): boolean {
  if (!opNeedsValue(op)) return true;
  if (op === "between") {
    if (!Array.isArray(value) || value.length !== 2) return false;
    const [a, b] = value;
    return a !== null && a !== undefined && b !== null && b !== undefined;
  }
  if (op === "in" || op === "not-in") {
    return Array.isArray(value) && value.length > 0;
  }
  if (op === "relative") {
    return isRelativeValue(value) && value.n > 0;
  }
  if (typeof value === "string") return value !== "";
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  return false;
}

// ---------------------------------------------------------------------------
// Field picker (add flow, step 1)
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
        <input
          type="text"
          placeholder="Search fields"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
        />
      </div>
      <div className="flex flex-col gap-1 p-2">
        {Object.keys(groups).map((group) => (
          <div key={group} className="flex flex-col gap-0.5">
            {group && (
              <div className="px-2 pt-1 text-xs text-muted-foreground">
                {group}
              </div>
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
// Field dropdown (editor, top-left)
// ---------------------------------------------------------------------------

function FieldDropdown({
  fields,
  currentId,
  onPick,
}: {
  fields: FieldDescriptor[];
  currentId: string;
  onPick: (id: string) => void;
}) {
  const current = fields.find((f) => f.id === currentId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-sm cursor-pointer hover:bg-accent"
        >
          <span className="text-foreground truncate max-w-[12ch]">
            {current?.label ?? "Field"}
          </span>
          <ChevronDown size={12} className="text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-auto">
        {fields.map((f) => (
          <DropdownMenuItem
            key={f.id}
            onSelect={() => onPick(f.id)}
            className="cursor-pointer"
          >
            {f.label}
          </DropdownMenuItem>
        ))}
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
          className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-sm cursor-pointer hover:bg-accent"
        >
          <span className="text-foreground">
            {opLabel(op, field.dataType)}
          </span>
          <ChevronDown size={12} className="text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {field.ops.map((o) => (
          <DropdownMenuItem
            key={o}
            onSelect={() => onChange(o)}
            className="cursor-pointer"
          >
            {opLabel(o, field.dataType)}
            <span className="ml-2 text-xs text-muted-foreground">
              {OP_LABEL[o]}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Value editor — per dataType + op
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
    return (
      <div className="px-1 text-xs text-muted-foreground">
        No value needed.
      </div>
    );
  }

  // Multi-select (in / not-in) — applies to enum and relation alike.
  if (op === "in" || op === "not-in") {
    const choices = field.enumValues ?? [];
    if (choices.length === 0) {
      return (
        <TextOrNumberInput
          dataType="string"
          value={value}
          onChange={onChange}
        />
      );
    }
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-col gap-1">
        <div className="max-h-48 overflow-auto rounded-md border border-border">
          {choices.map((c) => {
            const checked = selected.includes(c);
            return (
              <label
                key={c}
                className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-accent cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    onChange(
                      e.target.checked
                        ? [...selected, c]
                        : selected.filter((s) => s !== c),
                    );
                  }}
                />
                <span className="text-foreground">{c}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  // Single enum (eq/neq)
  if (field.dataType === "enum" && (op === "eq" || op === "neq")) {
    const choices = field.enumValues ?? [];
    return (
      <select
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        autoFocus
        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary cursor-pointer"
      >
        <option value="" disabled>
          Select…
        </option>
        {choices.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    );
  }

  // Boolean (eq/neq)
  if (field.dataType === "boolean" && (op === "eq" || op === "neq")) {
    const v = typeof value === "boolean" ? value : value === "true";
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={cn(
            "flex-1 rounded-md border px-2 py-1 text-sm cursor-pointer",
            v
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:bg-accent",
          )}
        >
          true
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={cn(
            "flex-1 rounded-md border px-2 py-1 text-sm cursor-pointer",
            !v
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:bg-accent",
          )}
        >
          false
        </button>
      </div>
    );
  }

  // Between (numeric or date)
  if (op === "between") {
    const arr = Array.isArray(value) ? value : ([null, null] as const);
    const [a, b] = arr as [unknown, unknown];
    const isDate = field.dataType === "date";
    return (
      <div className="flex items-center gap-2">
        <BetweenInput
          isDate={isDate}
          value={a}
          onChange={(next) => onChange([next, b] as [number, number])}
        />
        <span className="text-sm text-muted-foreground">and</span>
        <BetweenInput
          isDate={isDate}
          value={b}
          onChange={(next) => onChange([a, next] as [number, number])}
        />
      </div>
    );
  }

  // Relative (date)
  if (op === "relative") {
    const rv: RelativeValue = isRelativeValue(value)
      ? value
      : { n: 7, unit: "days", dir: "past" };
    return (
      <div className="flex items-center gap-2">
        <select
          value={rv.dir}
          onChange={(e) =>
            onChange({ ...rv, dir: e.target.value as RelativeDir })
          }
          className="rounded-md border border-border bg-background px-2 py-1 text-sm cursor-pointer"
        >
          <option value="past">Last</option>
          <option value="next">Next</option>
        </select>
        <input
          type="number"
          min={1}
          value={rv.n}
          onChange={(e) =>
            onChange({ ...rv, n: Math.max(1, Number(e.target.value || 1)) })
          }
          className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
        />
        <select
          value={rv.unit}
          onChange={(e) =>
            onChange({ ...rv, unit: e.target.value as RelativeUnit })
          }
          className="rounded-md border border-border bg-background px-2 py-1 text-sm cursor-pointer"
        >
          <option value="days">days</option>
          <option value="weeks">weeks</option>
          <option value="months">months</option>
        </select>
      </div>
    );
  }

  // Date single (lt/lte/gt/gte)
  if (field.dataType === "date") {
    return (
      <input
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        autoFocus
        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
      />
    );
  }

  // Default: text or number input
  return (
    <TextOrNumberInput
      dataType={field.dataType === "number" ? "number" : "string"}
      value={value}
      onChange={onChange}
    />
  );
}

function BetweenInput({
  isDate,
  value,
  onChange,
}: {
  isDate: boolean;
  value: unknown;
  onChange: (next: number | string) => void;
}) {
  if (isDate) {
    return (
      <input
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
      />
    );
  }
  return (
    <input
      type="number"
      value={value == null ? "" : Number(value)}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
    />
  );
}

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
        value={
          typeof value === "number" ? value : value == null ? "" : String(value)
        }
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : Number(e.target.value))
        }
        autoFocus
        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
      />
    );
  }
  return (
    <input
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      autoFocus
      className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
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
