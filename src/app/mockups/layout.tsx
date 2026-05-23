import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Mockups — Simplesat Vision",
};

export default function MockupsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
          <Link
            href="/mockups"
            className="inline-flex items-center gap-1.5 text-base font-medium text-foreground hover:text-primary"
          >
            <ArrowLeft className="size-4" />
            Mockups gallery
          </Link>
          <Link
            href="/"
            className="text-base text-muted-foreground hover:text-foreground"
          >
            Back to app
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
