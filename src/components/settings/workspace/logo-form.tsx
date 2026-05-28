"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearWorkspaceLogo,
  fetchWorkspaceLogo,
} from "@/lib/workspaces/actions";

/** Big-initial placeholder used when no logo is set. Mirrors the avatar
 *  affordance in the sidebar workspace switcher so the two surfaces feel
 *  unified — same shape, same typography, just bigger. */
function InitialPlaceholder({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      aria-hidden
      className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-foreground text-4xl font-semibold text-background"
    >
      {initial}
    </div>
  );
}

export function LogoForm({
  workspaceName,
  initialDomain,
  initialLogoUrl,
  isAdmin,
}: {
  workspaceName: string;
  initialDomain: string | null;
  initialLogoUrl: string | null;
  isAdmin: boolean;
}) {
  const [domain, setDomain] = useState(initialDomain ?? "");
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [error, setError] = useState<string | null>(null);
  const [imageErrored, setImageErrored] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await fetchWorkspaceLogo(null, formData);
      if (result.ok) {
        setLogoUrl(result.logoUrl);
        setDomain(result.domain);
        setError(null);
        setImageErrored(false);
      } else {
        setError(result.error);
      }
    });
  }

  function handleClear() {
    startTransition(async () => {
      const result = await clearWorkspaceLogo();
      if (result.ok) {
        setLogoUrl(null);
        setError(null);
        setImageErrored(false);
      } else {
        setError(result.error);
      }
    });
  }

  const showLogo = logoUrl && !imageErrored;

  return (
    <div className="flex items-start gap-5">
      <div className="shrink-0">
        {showLogo ? (
          <Image
            src={logoUrl}
            alt={`${workspaceName} logo`}
            width={80}
            height={80}
            unoptimized
            className="h-20 w-20 rounded-lg bg-muted object-contain ring-1 ring-foreground/10"
            onError={() => setImageErrored(true)}
          />
        ) : (
          <InitialPlaceholder name={workspaceName} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {isAdmin ? (
          <>
            <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
              <Input
                name="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="simplesat.io"
                maxLength={253}
                className="h-8 w-64 text-base"
                aria-label="Workspace domain"
                disabled={isPending}
              />
              <Button type="submit" size="sm" disabled={isPending || !domain.trim()}>
                {isPending
                  ? "Fetching…"
                  : logoUrl
                    ? "Update logo"
                    : "Fetch from Brandfetch"}
              </Button>
              {logoUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  disabled={isPending}
                >
                  <Trash2 data-icon="inline-start" />
                  Remove
                </Button>
              ) : null}
            </form>
            <p className="mt-2 text-sm text-muted-foreground">
              We pull the logo from{" "}
              <a
                href="https://brandfetch.com"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                Brandfetch
              </a>
              {" "}using this workspace&apos;s public-web domain.
            </p>
            {error ? (
              <p className="mt-2 text-sm text-destructive">{error}</p>
            ) : null}
          </>
        ) : (
          <p className="text-base text-muted-foreground">
            {domain ? domain : "No domain set"}
          </p>
        )}
      </div>
    </div>
  );
}
