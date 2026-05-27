import { colorFromName, dicebearUrl, initialsFromName } from "./color-from-name";

/** Avatar resolution cascade. Precedence (highest first):
 *
 *    manual upload  >  helpdesk/CRM sync  >  Gravatar  >  DiceBear  >  initials
 *
 *  Only the first two tiers are *stored* (`customers.avatarUrl` /
 *  `team_members.avatarUrl`, tagged by `avatarSource`). Gravatar and DiceBear
 *  are *derived* at render time and never persisted — Gravatar from the email
 *  hash, DiceBear deterministically from a stable seed.
 *
 *  This is the single seam the eventual product swaps: today the only stored
 *  URLs arrive via ingest (`avatarSource: 'helpdesk'`); when in-app uploads
 *  ship they write `avatarSource: 'manual'`, which the re-sync guard protects
 *  from being clobbered by a later integration sync. The render path doesn't
 *  change. */

// --- Gravatar ---------------------------------------------------------------

/** Gravatar avatar URL for an email. `?d=404` is load-bearing: a missing
 *  Gravatar must return HTTP 404 (not Gravatar's default placeholder) so the
 *  Avatar component's `onError` chain advances to the DiceBear tier instead of
 *  showing a generic Gravatar mystery-person.
 *
 *  Gravatar still fully supports the legacy MD5 hash, which we use because it's
 *  synchronous — `crypto.subtle.digest` (SHA-256) is async and unusable inside
 *  a synchronous render. The email is trimmed + lowercased per the Gravatar
 *  spec before hashing. */
export function gravatarUrl(email: string, size = 160): string {
  const hash = md5(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash}?d=404&s=${size}`;
}

// --- Cascade resolver -------------------------------------------------------

export type ResolveAvatarInput = {
  /** Stored URL (manual upload or helpdesk sync). Highest precedence. */
  avatarUrl?: string | null;
  /** Display name — drives initials, the color fallback, AND the DiceBear seed.
   *  Always required.
   *
   *  DiceBear is seeded by name (not email/id) on purpose: the self-hosted
   *  `public/avatars/<hash>.svg` set is name-keyed and regenerated at seed time,
   *  so the render seed must match the generator's seed. See
   *  scripts/generate-avatars.ts. */
  name: string;
  /** When provided, a Gravatar tier is inserted into the cascade between any
   *  stored URL and the DiceBear fallback.
   *
   *  Pass `email` only where a Gravatar network probe is cheap — single-avatar
   *  surfaces like a detail header or a lazy hover popover. Omit it on
   *  high-volume surfaces (list rows, pills): probing Gravatar per row would
   *  fire a 404 for every avatar before falling through to DiceBear. */
  email?: string | null;
  /** Pre-computed background color (e.g. `team_members.avatarColor`). Falls
   *  back to a deterministic color derived from the name. */
  avatarColor?: string | null;
};

export type ResolvedAvatar = {
  /** Ordered candidate image URLs. The Avatar component tries each in turn,
   *  advancing on load failure, before falling back to `initials` on `bg`. */
  sources: string[];
  bg: string;
  initials: string;
};

export function resolveAvatar(input: ResolveAvatarInput): ResolvedAvatar {
  const seed = input.name;
  const sources: string[] = [];
  if (input.avatarUrl) sources.push(input.avatarUrl);
  if (input.email) sources.push(gravatarUrl(input.email));
  sources.push(dicebearUrl(seed));
  return {
    sources,
    bg: input.avatarColor ?? colorFromName(input.name),
    initials: initialsFromName(input.name),
  };
}

// --- MD5 (sync, dependency-free) --------------------------------------------
// Minimal RFC 1321 implementation. Used solely for Gravatar's email hash, which
// is not a security context — it just needs to match Gravatar's expected digest.
// Operates on the UTF-8 bytes of the (already trimmed + lowercased) email.

function md5(input: string): string {
  const bytes = utf8Bytes(input);
  const bitLen = bytes.length * 8;
  const x = bytesToWords(bytes);

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < x.length; i += 16) {
    const oa = a;
    const ob = b;
    const oc = c;
    const od = d;

    a = ff(a, b, c, d, x[i], 7, -680876936);
    d = ff(d, a, b, c, x[i + 1], 12, -389564586);
    c = ff(c, d, a, b, x[i + 2], 17, 606105819);
    b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = ff(a, b, c, d, x[i + 4], 7, -176418897);
    d = ff(d, a, b, c, x[i + 5], 12, 1200080426);
    c = ff(c, d, a, b, x[i + 6], 17, -1473231341);
    b = ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = ff(a, b, c, d, x[i + 8], 7, 1770035416);
    d = ff(d, a, b, c, x[i + 9], 12, -1958414417);
    c = ff(c, d, a, b, x[i + 10], 17, -42063);
    b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = ff(a, b, c, d, x[i + 12], 7, 1804603682);
    d = ff(d, a, b, c, x[i + 13], 12, -40341101);
    c = ff(c, d, a, b, x[i + 14], 17, -1502002290);
    b = ff(b, c, d, a, x[i + 15], 22, 1236535329);

    a = gg(a, b, c, d, x[i + 1], 5, -165796510);
    d = gg(d, a, b, c, x[i + 6], 9, -1069501632);
    c = gg(c, d, a, b, x[i + 11], 14, 643717713);
    b = gg(b, c, d, a, x[i], 20, -373897302);
    a = gg(a, b, c, d, x[i + 5], 5, -701558691);
    d = gg(d, a, b, c, x[i + 10], 9, 38016083);
    c = gg(c, d, a, b, x[i + 15], 14, -660478335);
    b = gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = gg(a, b, c, d, x[i + 9], 5, 568446438);
    d = gg(d, a, b, c, x[i + 14], 9, -1019803690);
    c = gg(c, d, a, b, x[i + 3], 14, -187363961);
    b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = gg(a, b, c, d, x[i + 13], 5, -1444681467);
    d = gg(d, a, b, c, x[i + 2], 9, -51403784);
    c = gg(c, d, a, b, x[i + 7], 14, 1735328473);
    b = gg(b, c, d, a, x[i + 12], 20, -1926607734);

    a = hh(a, b, c, d, x[i + 5], 4, -378558);
    d = hh(d, a, b, c, x[i + 8], 11, -2022574463);
    c = hh(c, d, a, b, x[i + 11], 16, 1839030562);
    b = hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = hh(a, b, c, d, x[i + 1], 4, -1530992060);
    d = hh(d, a, b, c, x[i + 4], 11, 1272893353);
    c = hh(c, d, a, b, x[i + 7], 16, -155497632);
    b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = hh(a, b, c, d, x[i + 13], 4, 681279174);
    d = hh(d, a, b, c, x[i], 11, -358537222);
    c = hh(c, d, a, b, x[i + 3], 16, -722521979);
    b = hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = hh(a, b, c, d, x[i + 9], 4, -640364487);
    d = hh(d, a, b, c, x[i + 12], 11, -421815835);
    c = hh(c, d, a, b, x[i + 15], 16, 530742520);
    b = hh(b, c, d, a, x[i + 2], 23, -995338651);

    a = ii(a, b, c, d, x[i], 6, -198630844);
    d = ii(d, a, b, c, x[i + 7], 10, 1126891415);
    c = ii(c, d, a, b, x[i + 14], 15, -1416354905);
    b = ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = ii(a, b, c, d, x[i + 12], 6, 1700485571);
    d = ii(d, a, b, c, x[i + 3], 10, -1894986606);
    c = ii(c, d, a, b, x[i + 10], 15, -1051523);
    b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = ii(a, b, c, d, x[i + 8], 6, 1873313359);
    d = ii(d, a, b, c, x[i + 15], 10, -30611744);
    c = ii(c, d, a, b, x[i + 6], 15, -1560198380);
    b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = ii(a, b, c, d, x[i + 4], 6, -145523070);
    d = ii(d, a, b, c, x[i + 11], 10, -1120210379);
    c = ii(c, d, a, b, x[i + 2], 15, 718787259);
    b = ii(b, c, d, a, x[i + 9], 21, -343485551);

    a = add(a, oa);
    b = add(b, ob);
    c = add(c, oc);
    d = add(d, od);
  }

  return wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);

  // Block layout: append 0x80, pad to 56 mod 64, then the 64-bit bit length.
  function bytesToWords(src: number[]): number[] {
    const padded = src.slice();
    padded.push(0x80);
    while (padded.length % 64 !== 56) padded.push(0);
    const words = new Array<number>(padded.length / 4).fill(0);
    for (let j = 0; j < padded.length; j++) {
      words[j >> 2] |= padded[j] << ((j % 4) * 8);
    }
    words.push(bitLen & 0xffffffff);
    words.push(Math.floor(bitLen / 0x100000000));
    return words;
  }
}

function utf8Bytes(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      // Surrogate pair → single code point.
      const next = str.charCodeAt(i + 1);
      code = 0x10000 + ((code & 0x3ff) << 10) + (next & 0x3ff);
      i++;
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      out.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return out;
}

function add(x: number, y: number): number {
  const lsw = (x & 0xffff) + (y & 0xffff);
  const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xffff);
}

function rotl(num: number, cnt: number): number {
  return (num << cnt) | (num >>> (32 - cnt));
}

function cmn(
  q: number,
  a: number,
  b: number,
  x: number,
  s: number,
  t: number,
): number {
  return add(rotl(add(add(a, q), add(x, t)), s), b);
}

function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn((b & c) | (~b & d), a, b, x, s, t);
}
function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn((b & d) | (c & ~d), a, b, x, s, t);
}
function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn(b ^ c ^ d, a, b, x, s, t);
}
function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
  return cmn(c ^ (b | ~d), a, b, x, s, t);
}

function wordToHex(value: number): string {
  let hex = "";
  for (let j = 0; j < 4; j++) {
    const byte = (value >> (j * 8)) & 0xff;
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}
