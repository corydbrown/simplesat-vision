"use client";

import { X } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Minimum shape an option must satisfy. Callers may extend with extras
 *  (e.g. `count`, `avatarColor`) and read them in `renderOption`. */
export type MultiSelectOption = { value: string; label: string };

type MultiSelectInputProps<T extends MultiSelectOption> = {
  value: string[];
  onChange: (next: string[]) => void;
  /** Search query — caller-controlled so it can drive the option fetcher. */
  query: string;
  onQueryChange: (q: string) => void;
  /** Options to render in the dropdown. Callers pre-filter for query + exclude
   *  already-selected values (or skip the client filter when the fetcher already
   *  filters server-side, as with relation typeahead). */
  options: T[];
  /** True while the option source is fetching. Used by `renderEmpty`. */
  loading?: boolean;
  /** Render a selected pill. */
  renderPill: (value: string, onRemove: () => void) => ReactNode;
  /** Render the interior of a dropdown option row. The primitive wraps it in
   *  a button and wires up the select handler. */
  renderOption: (option: T) => ReactNode;
  /** When false, the dropdown panel is hidden entirely if there are no
   *  options (the enum-multi case — caller-side enum lists have nothing to
   *  show when fully selected). Defaults to true. */
  alwaysShowDropdown?: boolean;
  /** Rendered inside the dropdown panel when `options` is empty. Receives
   *  `loading` so the caller can switch between "Loading…" / "Searching…" and
   *  the relevant "no results" copy. */
  renderEmpty?: (loading: boolean) => ReactNode;
  /** Tailwind max-height class applied to the dropdown panel. */
  dropdownMaxHeight?: string;
};

export function MultiSelectInput<T extends MultiSelectOption>({
  value,
  onChange,
  query,
  onQueryChange,
  options,
  loading = false,
  renderPill,
  renderOption,
  alwaysShowDropdown = true,
  renderEmpty,
  dropdownMaxHeight = "max-h-56",
}: MultiSelectInputProps<T>) {
  const showDropdown = alwaysShowDropdown || options.length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-background px-1.5 py-1 min-h-9 focus-within:border-primary">
        {value.map((v) => (
          <Fragment key={v}>
            {renderPill(v, () =>
              onChange(value.filter((x) => x !== v)),
            )}
          </Fragment>
        ))}
        <input
          type="text"
          autoFocus
          placeholder={value.length === 0 ? "Search…" : ""}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {showDropdown && (
        <div
          className={cn(
            "overflow-auto rounded-md border border-border bg-popover",
            dropdownMaxHeight,
          )}
        >
          {options.length === 0 && renderEmpty?.(loading)}
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange([...value, o.value]);
                onQueryChange("");
              }}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-left hover:bg-accent cursor-pointer"
            >
              {renderOption(o)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type MultiSelectPillProps = {
  label: string;
  avatar?: ReactNode;
  onRemove: () => void;
};

/** The pill rendered inside the pills-in-input container for each selected
 *  value. Exported so callers that need a custom pill wrapper (e.g. the
 *  relation pill, which resolves an avatar from a label cache) can compose
 *  it directly. */
export function MultiSelectPill({
  label,
  avatar,
  onRemove,
}: MultiSelectPillProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-sm text-foreground max-w-[14ch]">
      {avatar}
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer shrink-0"
      >
        <X size={11} />
      </button>
    </span>
  );
}
