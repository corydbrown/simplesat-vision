export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="flex gap-1 truncate">
      {tags.map((t) => (
        <Tag key={t}>{t}</Tag>
      ))}
    </div>
  );
}
