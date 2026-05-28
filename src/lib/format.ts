const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const numberFormatter = new Intl.NumberFormat("en-US");

export function formatDate(value: Date | number | null | undefined): string {
  if (value == null) return "-";
  return dateFormatter.format(typeof value === "number" ? new Date(value) : value);
}

export function formatDateTime(
  value: Date | number | null | undefined,
): string {
  if (value == null) return "-";
  return dateTimeFormatter.format(
    typeof value === "number" ? new Date(value) : value,
  );
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currencyFineFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/** Format integer USD cents as a display currency string. Values below $0.01
 *  show up to 4 decimal places so per-evaluation token costs (often a fraction
 *  of a cent) don't all collapse to "$0.00". */
export function formatCurrencyCents(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "-";
  const dollars = cents / 100;
  if (Math.abs(dollars) < 0.01) return currencyFineFormatter.format(dollars);
  return currencyFormatter.format(dollars);
}

const relativeFormatter = new Intl.RelativeTimeFormat("en-US", {
  numeric: "auto",
});

export function formatRelative(
  value: Date | number | null | undefined,
  now: Date = new Date(),
): string {
  if (value == null) return "-";
  const ms = typeof value === "number" ? value : value.getTime();
  const diff = ms - now.getTime();
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;
  if (abs < minute) return "just now";
  if (abs < hour)
    return relativeFormatter.format(Math.round(diff / minute), "minute");
  if (abs < day)
    return relativeFormatter.format(Math.round(diff / hour), "hour");
  if (abs < week)
    return relativeFormatter.format(Math.round(diff / day), "day");
  if (abs < month)
    return relativeFormatter.format(Math.round(diff / week), "week");
  if (abs < year)
    return relativeFormatter.format(Math.round(diff / month), "month");
  return relativeFormatter.format(Math.round(diff / year), "year");
}

const timeOfDayFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const monthDayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const monthDayYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const weekdayFullFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** Full absolute date+time for hover tooltips on relative timestamps:
 *  "May 24, 2026 at 3:42 PM". Locale-aware via Intl, never ISO. */
export function formatAbsolute(
  value: Date | number | string | null | undefined,
): string {
  if (value == null) return "-";
  const date =
    typeof value === "number"
      ? new Date(value)
      : typeof value === "string"
        ? new Date(value)
        : value;
  return `${monthDayYearFormatter.format(date)} at ${timeOfDayFormatter.format(date)}`;
}

/** Activity-feed time: relative for the recent past (<24h: "3h ago",
 *  <7 days: "Mon at 2:14 PM"), then absolute (this year: "May 4, 2:14 PM",
 *  prior years: "May 4, 2024"). Designed to read at-a-glance in a stream
 *  where "6 months ago" loses precision. */
export function formatSmartTime(
  value: Date | number | null | undefined,
  now: Date = new Date(),
): string {
  if (value == null) return "-";
  const date = typeof value === "number" ? new Date(value) : value;
  const ms = date.getTime();
  const diff = Math.abs(now.getTime() - ms);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.round(diff / minute)}m ago`;
  if (diff < day) return `${Math.round(diff / hour)}h ago`;
  if (diff < week) {
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(
      date,
    );
    return `${weekday} at ${timeOfDayFormatter.format(date)}`;
  }
  if (date.getFullYear() === now.getFullYear()) {
    return `${monthDayFormatter.format(date)}, ${timeOfDayFormatter.format(date)}`;
  }
  return `${monthDayYearFormatter.format(date)}, ${timeOfDayFormatter.format(date)}`;
}

/** Day-grouping label for timeline dividers. Returns "Today" / "Yesterday"
 *  for those days, the weekday for <7 days ago, then absolute. */
export function formatTimelineDay(
  value: Date | number | null | undefined,
  now: Date = new Date(),
): string {
  if (value == null) return "-";
  const date = typeof value === "number" ? new Date(value) : value;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (today.getTime() - that.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(date);
  }
  return weekdayFullFormatter.format(date);
}

export function formatDuration(
  start: Date | number | null | undefined,
  end: Date | number | null | undefined,
): string {
  if (start == null || end == null) return "-";
  const startMs = typeof start === "number" ? start : start.getTime();
  const endMs = typeof end === "number" ? end : end.getTime();
  const diff = Math.max(0, endMs - startMs);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const m = minutes % 60;
    return m === 0 ? `${hours}h` : `${hours}h ${m}m`;
  }
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return h === 0 ? `${days}d` : `${days}d ${h}h`;
}
