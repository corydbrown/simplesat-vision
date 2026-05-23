import { promises as fs } from "fs";
import path from "path";

export type Classification = "flag" | "non-color";

export type MissingToken = {
  name: string;
  rootValue: string;
  classification: Classification;
};

export type DarkOverrideDiff = {
  missingFromDark: MissingToken[];
  allowListed: string[];
  rootTokenCount: number;
  darkTokenCount: number;
  allowListSize: number;
};

const HUES = ["grey", "green", "red", "blue", "purple", "teal", "yellow"] as const;

function buildAllowList(): Set<string> {
  const allow = new Set<string>(["--black", "--white"]);
  for (const hue of HUES) {
    allow.add(`--${hue}`);
    allow.add(`--${hue}-light`);
    allow.add(`--${hue}-dark`);
  }
  return allow;
}

function extractBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*\\{`);
  const m = re.exec(css);
  if (!m) return "";
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  while (i < css.length && depth > 0) {
    const ch = css[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }
  return depth === 0 ? css.slice(start, i - 1) : "";
}

function parseTokens(block: string): Map<string, string> {
  const tokens = new Map<string, string>();
  const stripped = block.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /(--[A-Za-z0-9-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    tokens.set(m[1], m[2].trim());
  }
  return tokens;
}

function classify(name: string): Classification {
  if (name === "--radius" || name.startsWith("--radius-")) return "non-color";
  return "flag";
}

export async function loadGlobalsCss(): Promise<string> {
  return fs.readFile(path.join(process.cwd(), "src/app/globals.css"), "utf8");
}

/**
 * Diff `:root` against `.dark` in a Tailwind v4 token sheet. Returns every
 * token declared in `:root` and missing from `.dark`, minus the documented
 * absolute-shade allow-list (--black, --white, and base / -light / -dark per
 * Tier-1 hue). Items still surfaced are split into `flag` (color tokens —
 * real drift) and `non-color` (e.g. --radius — sizing token, doesn't flip).
 */
export function diffDarkOverrides(css: string): DarkOverrideDiff {
  const rootTokens = parseTokens(extractBlock(css, ":root"));
  const darkTokens = parseTokens(extractBlock(css, ".dark"));
  const allow = buildAllowList();

  const missing: MissingToken[] = [];
  const allowListed: string[] = [];

  for (const [name, value] of rootTokens) {
    if (darkTokens.has(name)) continue;
    if (allow.has(name)) {
      allowListed.push(name);
      continue;
    }
    missing.push({ name, rootValue: value, classification: classify(name) });
  }

  missing.sort((a, b) => {
    if (a.classification !== b.classification) {
      return a.classification === "flag" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  allowListed.sort();

  return {
    missingFromDark: missing,
    allowListed,
    rootTokenCount: rootTokens.size,
    darkTokenCount: darkTokens.size,
    allowListSize: allow.size,
  };
}
