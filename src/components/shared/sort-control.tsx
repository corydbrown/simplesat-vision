"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  ChevronDown,
  GripVertical,
  Plus,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GroupHeading } from "@/components/shared/group-heading";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  encodeSortParam,
  parseSortParam,
  type SortDir,
  type SortSpec,
} from "@/lib/sort/url-state";
import type { Property } from "@/lib/properties/types";

export function SortControl<T>({
  properties,
  paramPrefix = "",
}: {
  properties: Property<T>[];
  paramPrefix?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sortParam = `${paramPrefix}sort`;

  const sortable = useMemo(
    () => properties.filter((p) => p.sortable),
    [properties],
  );
  const propsById = useMemo(
    () => Object.fromEntries(sortable.map((p) => [p.id, p])),
    [sortable],
  );
  const sorts = useMemo(
    () => parseSortParam(searchParams.get(sortParam) ?? undefined),
    [searchParams, sortParam],
  );

  function commit(next: SortSpec[]) {
    const params = new URLSearchParams(searchParams.toString());
    const encoded = encodeSortParam(next);
    if (encoded) params.set(sortParam, encoded);
    else params.delete(sortParam);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function addSort(key: string) {
    if (sorts.some((s) => s.key === key)) return;
    const p = propsById[key];
    const isDate = p?.filter?.dataType === "date";
    commit([...sorts, { key, dir: isDate ? "desc" : "asc" }]);
  }
  function removeSort(key: string) {
    commit(sorts.filter((s) => s.key !== key));
  }
  function setDir(key: string, dir: SortDir) {
    commit(sorts.map((s) => (s.key === key ? { ...s, dir } : s)));
  }
  function reorder(oldIndex: number, newIndex: number) {
    commit(arrayMove(sorts, oldIndex, newIndex));
  }
  function clearAll() {
    commit([]);
  }

  const triggerLabel = (() => {
    if (sorts.length === 0) return "Sort";
    if (sorts.length === 1) {
      const p = propsById[sorts[0].key];
      const label = p?.label ?? sorts[0].key;
      const arrow = sorts[0].dir === "asc" ? "↑" : "↓";
      return `Sort by ${label} ${arrow}`;
    }
    return `Sort by ${sorts.length}`;
  })();

  const usedKeys = new Set(sorts.map((s) => s.key));
  const available = sortable.filter((p) => !usedKeys.has(p.id));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = sorts.findIndex((s) => s.key === active.id);
    const newIndex = sorts.findIndex((s) => s.key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    reorder(oldIndex, newIndex);
  }

  // Single popover surface for both states. When empty, content is the
  // property picker; picking transitions the same popover into the rows
  // editor without closing.
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 cursor-pointer gap-1.5 text-sm",
            sorts.length > 0
              ? "bg-blue-lighter text-blue-darker hover:bg-blue-lighter hover:text-blue-darker aria-expanded:bg-blue-lighter aria-expanded:text-blue-darker"
              : "text-muted-foreground",
          )}
        >
          <ArrowDownUp size={13} />
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={sorts.length === 0 ? "w-56 p-1" : "w-80 gap-2"}
      >
        {sorts.length === 0 ? (
          <PropertyPicker available={sortable} onPick={addSort} />
        ) : (
          <>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sorts.map((s) => s.key)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-1">
                  {sorts.map((s) => {
                    const p = propsById[s.key];
                    return (
                      <SortRow
                        key={s.key}
                        spec={s}
                        label={p?.label ?? s.key}
                        otherAvailable={available}
                        currentProperty={p}
                        sortable={sortable}
                        onChangeKey={(nextKey) => {
                          if (nextKey === s.key) return;
                          commit(
                            sorts.map((x) =>
                              x.key === s.key ? { ...x, key: nextKey } : x,
                            ),
                          );
                        }}
                        onToggleDir={() =>
                          setDir(s.key, s.dir === "asc" ? "desc" : "asc")
                        }
                        onRemove={() => removeSort(s.key)}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>

            <div className="flex items-center justify-between gap-2">
              <AddSortMenu
                available={available}
                onPick={addSort}
                disabled={available.length === 0}
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 cursor-pointer px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={clearAll}
              >
                Clear sort
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Shared grouping + iteration for the two property pickers (PropertyPicker
 *  and AddSortMenu). Each caller controls its own chrome via render props. */
function GroupedPropertyList<T>({
  properties,
  renderLabel,
  renderItem,
}: {
  properties: Property<T>[];
  renderLabel: (label: string, index: number) => React.ReactNode;
  renderItem: (p: Property<T>) => React.ReactNode;
}) {
  const groups = new Map<string, Property<T>[]>();
  for (const p of properties) {
    const g = p.sourceEntity;
    const arr = groups.get(g) ?? [];
    arr.push(p);
    groups.set(g, arr);
  }
  return (
    <>
      {[...groups.entries()].map(([groupLabel, props], i) => (
        <div key={groupLabel}>
          {renderLabel(groupLabel, i)}
          {props.map((p) => renderItem(p))}
        </div>
      ))}
    </>
  );
}

/** Picker rendered directly inside the popover for the empty state. */
function PropertyPicker<T>({
  available,
  onPick,
}: {
  available: Property<T>[];
  onPick: (key: string) => void;
}) {
  return (
    <div className="max-h-[60vh] overflow-y-auto">
      <GroupedPropertyList
        properties={available}
        renderLabel={(label) => <GroupHeading>{label}</GroupHeading>}
        renderItem={(p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.id)}
            className="block w-full cursor-pointer rounded px-2 py-1 text-left text-sm hover:bg-accent"
          >
            {p.label}
          </button>
        )}
      />
    </div>
  );
}

function SortRow<T>({
  spec,
  label,
  otherAvailable,
  currentProperty,
  sortable,
  onChangeKey,
  onToggleDir,
  onRemove,
}: {
  spec: SortSpec;
  label: string;
  otherAvailable: Property<T>[];
  currentProperty: Property<T> | undefined;
  sortable: Property<T>[];
  onChangeKey: (key: string) => void;
  onToggleDir: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: spec.key });

  // Property picker shows: current selection + all other not-yet-used properties.
  const pickerOptions = currentProperty
    ? [currentProperty, ...otherAvailable]
    : [...sortable];

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-1 rounded"
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="flex h-7 w-5 cursor-grab items-center justify-center text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
        aria-label="Reorder sort"
      >
        <GripVertical size={13} />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 flex-1 cursor-pointer justify-between gap-1 px-2 text-sm font-normal"
          >
            <span className="truncate">{label}</span>
            <ChevronDown size={12} className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[60vh] w-56 overflow-y-auto">
          <GroupedPropertyList
            properties={pickerOptions}
            renderLabel={(groupLabel, i) => (
              <>
                {i > 0 && <DropdownMenuSeparator />}
                <GroupHeading>{groupLabel}</GroupHeading>
              </>
            )}
            renderItem={(p) => (
              <DropdownMenuItem
                key={p.id}
                onSelect={() => onChangeKey(p.id)}
                className={p.id === spec.key ? "bg-accent/50" : ""}
              >
                {p.label}
              </DropdownMenuItem>
            )}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="sm"
        className="h-7 w-7 cursor-pointer p-0"
        onClick={onToggleDir}
        aria-label={spec.dir === "asc" ? "Ascending" : "Descending"}
        title={spec.dir === "asc" ? "Ascending" : "Descending"}
      >
        {spec.dir === "asc" ? (
          <ArrowUp size={13} />
        ) : (
          <ArrowDown size={13} />
        )}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 cursor-pointer p-0 text-muted-foreground hover:text-foreground"
        onClick={onRemove}
        aria-label="Remove sort"
      >
        <X size={13} />
      </Button>
    </div>
  );
}

function AddSortMenu<T>({
  available,
  onPick,
  disabled,
}: {
  available: Property<T>[];
  onPick: (key: string) => void;
  disabled: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 cursor-pointer gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          disabled={disabled}
        >
          <Plus size={12} />
          Add sort
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[60vh] w-56 overflow-y-auto">
        <GroupedPropertyList
          properties={available}
          renderLabel={(groupLabel, i) => (
            <>
              {i > 0 && <DropdownMenuSeparator />}
              <GroupHeading>{groupLabel}</GroupHeading>
            </>
          )}
          renderItem={(p) => (
            <DropdownMenuItem key={p.id} onSelect={() => onPick(p.id)}>
              {p.label}
            </DropdownMenuItem>
          )}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
