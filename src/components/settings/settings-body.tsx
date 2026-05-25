import { SettingsNav } from "./settings-nav";

export function SettingsBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 min-w-0">
      <SettingsNav />
      <main className="flex-1 min-w-0 px-14 py-10">{children}</main>
    </div>
  );
}
