import Link from "next/link";

export type HeatmapRow = {
  id: string;
  label: React.ReactNode;
  sublabel?: React.ReactNode;
};

export type HeatmapCol = {
  id: string;
  label: React.ReactNode;
};

export type HeatmapCell<T = unknown> = {
  row: string;
  col: string;
  value: number;
  data?: T;
};

export type HeatmapProps<T = unknown> = {
  rows: HeatmapRow[];
  cols: HeatmapCol[];
  /** Sparse — any (row, col) not listed renders as an empty cell. */
  cells: HeatmapCell<T>[];
  /** Map a cell's value to a background+text class set
   *  (e.g. `bg-green-light text-green-darker`). */
  toneFor: (value: number, data: T | undefined) => string;
  /** Cell content. Defaults to `Math.round(value)`. */
  formatValue?: (value: number, data: T | undefined) => React.ReactNode;
  /** Native title attribute for the cell (acts as the hover tooltip). */
  tooltipFor?: (
    rowId: string,
    colId: string,
    value: number,
    data: T | undefined,
  ) => string | undefined;
  /** Empty-cell title attribute. */
  emptyTooltip?: (rowId: string, colId: string) => string | undefined;
  /** Wrap clickable cells in a Next Link to this href. Return undefined to
   *  render a non-interactive cell. */
  hrefFor?: (
    rowId: string,
    colId: string,
    value: number,
    data: T | undefined,
  ) => string | undefined;
  ariaLabel?: string;
  /** Width of the leading row-header column. Default `200px`. */
  rowHeaderWidth?: string;
};

const EMPTY_CELL_CLASS = "bg-muted/40 text-muted-foreground";

export function Heatmap<T = unknown>({
  rows,
  cols,
  cells,
  toneFor,
  formatValue,
  tooltipFor,
  emptyTooltip,
  hrefFor,
  ariaLabel,
  rowHeaderWidth = "200px",
}: HeatmapProps<T>) {
  const byKey = new Map<string, HeatmapCell<T>>();
  for (const cell of cells) byKey.set(`${cell.row}:${cell.col}`, cell);

  const gridTemplate = `${rowHeaderWidth} repeat(${cols.length}, minmax(0, 1fr))`;

  return (
    <div
      role="table"
      aria-label={ariaLabel}
      className="overflow-hidden rounded-md border border-border"
    >
      <div
        role="rowgroup"
        className="grid items-center gap-px border-b border-border bg-muted/40 text-sm text-muted-foreground"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <div role="columnheader" className="px-3 py-2" />
        {cols.map((col) => (
          <div
            role="columnheader"
            key={col.id}
            className="px-2 py-2 text-center"
          >
            {col.label}
          </div>
        ))}
      </div>
      <div role="rowgroup" className="divide-y divide-border">
        {rows.map((row) => (
          <div
            role="row"
            key={row.id}
            className="grid items-stretch gap-px"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            <div
              role="rowheader"
              className="flex flex-col justify-center px-3 py-2 text-base"
            >
              <span className="truncate text-foreground">{row.label}</span>
              {row.sublabel ? (
                <span className="truncate text-sm text-muted-foreground">
                  {row.sublabel}
                </span>
              ) : null}
            </div>
            {cols.map((col) => {
              const cell = byKey.get(`${row.id}:${col.id}`);
              if (!cell) {
                return (
                  <div
                    role="cell"
                    key={col.id}
                    title={emptyTooltip?.(row.id, col.id)}
                    className={`flex items-center justify-center px-2 py-3 text-sm ${EMPTY_CELL_CLASS}`}
                  >
                    —
                  </div>
                );
              }
              const tone = toneFor(cell.value, cell.data);
              const content = formatValue
                ? formatValue(cell.value, cell.data)
                : Math.round(cell.value);
              const title = tooltipFor?.(row.id, col.id, cell.value, cell.data);
              const href = hrefFor?.(row.id, col.id, cell.value, cell.data);
              const className = `flex items-center justify-center px-2 py-3 text-base font-medium tabular-nums ${tone} ${
                href ? "cursor-pointer transition hover:brightness-95" : ""
              }`;
              if (href) {
                return (
                  <Link
                    key={col.id}
                    href={href}
                    title={title}
                    className={className}
                  >
                    {content}
                  </Link>
                );
              }
              return (
                <div
                  role="cell"
                  key={col.id}
                  title={title}
                  className={className}
                >
                  {content}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
