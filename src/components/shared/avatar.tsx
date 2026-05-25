"use client";

import { useState } from "react";

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
  imageUrl,
}: {
  bg: string;
  initials: string;
  size?: AvatarSize;
  imageUrl?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = imageUrl && !imgFailed;

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ${SIZES[size]}`}
      style={showImage ? undefined : { backgroundColor: bg }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={initials}
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        initials || "?"
      )}
    </span>
  );
}
