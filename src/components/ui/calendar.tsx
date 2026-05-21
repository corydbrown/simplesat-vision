"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { cn } from "@/lib/utils";

export type CalendarProps = DayPickerProps;

/** Shadcn-style calendar built on react-day-picker v10.
 *  Adapted to our design tokens (primary / accent / destructive). The nav
 *  buttons are absolutely positioned to share the caption row so the month
 *  label and the < / > arrows sit on the same line. */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2", className)}
      classNames={{
        months: "relative flex flex-col gap-3",
        month: "flex flex-col gap-2",
        month_caption: "relative flex justify-center items-center h-8",
        caption_label: "text-[14px] font-medium text-foreground",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between h-8 px-1 z-10",
        button_previous: cn(
          "inline-flex items-center justify-center rounded-md h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer disabled:opacity-40",
        ),
        button_next: cn(
          "inline-flex items-center justify-center rounded-md h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer disabled:opacity-40",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-muted-foreground rounded-md w-8 font-normal text-[12px] flex items-center justify-center",
        week: "flex w-full mt-1",
        day: "h-8 w-8 text-center text-[14px] p-0 relative focus-within:relative focus-within:z-20",
        day_button: cn(
          "inline-flex items-center justify-center h-8 w-8 rounded-md text-[14px] font-normal cursor-pointer",
          "hover:bg-accent hover:text-foreground",
          "aria-selected:bg-primary aria-selected:text-primary-foreground aria-selected:hover:bg-primary aria-selected:hover:text-primary-foreground",
        ),
        range_start:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground rounded-l-md",
        range_end:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground rounded-r-md",
        range_middle:
          "bg-primary/10 [&>button]:bg-transparent [&>button]:text-foreground [&>button]:hover:bg-primary/20 [&>button]:rounded-none",
        selected: "",
        // Today: keep the day's number red regardless of selection state,
        // so it stays legible inside a selected range.
        today:
          "[&>button]:!text-destructive [&>button]:font-semibold",
        outside: "text-muted-foreground/40 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground/40 cursor-not-allowed",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft size={16} />
          ) : (
            <ChevronRight size={16} />
          ),
      }}
      {...props}
    />
  );
}
