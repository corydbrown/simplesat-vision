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
