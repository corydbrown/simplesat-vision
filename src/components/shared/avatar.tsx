"use client";

import { useState } from "react";

const SIZES = {
  sm: "h-5 w-5 text-xs",
  md: "h-6 w-6 text-xs",
  lg: "h-9 w-9 text-sm",
  xl: "h-10 w-10 text-base",
} as const;

export type AvatarSize = keyof typeof SIZES;

/**
 * Renders an avatar by walking an ordered list of candidate image URLs, falling
 * through to the next on load failure and finally to initials-on-color.
 *
 * The cascade (stored URL → Gravatar → DiceBear → initials) is built by
 * `resolveAvatar` in `src/lib/avatar.ts`; this component just consumes the
 * resulting `sources` array. Each tier advances only when its `<img>` actually
 * fails to load, which is why the Gravatar tier uses `?d=404` upstream — a
 * missing Gravatar 404s and we move on, rather than rendering a placeholder.
 *
 * `imageUrl` is a single-source convenience for callers that don't need the
 * full cascade (it's treated as a one-element `sources`).
 */
export function Avatar({
  bg,
  initials,
  size = "sm",
  imageUrl,
  sources,
}: {
  bg: string;
  initials: string;
  size?: AvatarSize;
  imageUrl?: string;
  sources?: string[];
}) {
  const candidates = sources ?? (imageUrl ? [imageUrl] : []);
  // Index into `candidates`; advances past each URL that fails to load. Once it
  // runs off the end we render initials on the color background.
  const [tier, setTier] = useState(0);
  const current = candidates[tier];

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ${SIZES[size]}`}
      style={current ? undefined : { backgroundColor: bg }}
    >
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          // Keying on the URL resets the <img> when we advance tiers so the
          // browser actually attempts the next source.
          key={current}
          src={current}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setTier((t) => t + 1)}
        />
      ) : (
        initials || "?"
      )}
    </span>
  );
}
