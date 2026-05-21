const SIZES = {
  sm: "h-5 w-5 text-xs",
  md: "h-6 w-6 text-xs",
  lg: "h-9 w-9 text-sm",
  xl: "h-10 w-10 text-base",
} as const;

export type AvatarSize = keyof typeof SIZES;

export function Avatar({
  bg,
  initials,
  size = "sm",
}: {
  bg: string;
  initials: string;
  size?: AvatarSize;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${SIZES[size]}`}
      style={{ backgroundColor: bg }}
    >
      {initials || "?"}
    </span>
  );
}
