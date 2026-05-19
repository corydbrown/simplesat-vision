export function Kbd({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      data-slot="kbd"
      className={`inline-flex h-4 min-w-4 items-center justify-center rounded border border-border bg-muted px-1 font-sans text-[10px] font-medium text-muted-foreground ${
        className ?? ""
      }`}
    >
      {children}
    </kbd>
  );
}
