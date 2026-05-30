import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// SVP-256: closed-set color-token + raw-hue guard. The production palette is
// theme-flippable named tokens (DESIGN.md): a bare base hue plus the
// `-light | -lighter | -dark | -darker` shades. Anything else — a raw Tailwind
// numeric shade (`bg-red-50`) or an invented shade (`bg-green-default`, which
// renders NO color and was SVP-251's P1 bug) — must not reach production code.
// One regex catches both: a color utility (or a `--color-*` var) on a known
// hue followed by a shade that is NOT in the valid set.
const BAD_COLOR_TOKEN =
  "(?:(?:bg|text|border|ring|fill|stroke|from|to|via|outline|decoration|divide|accent|caret)-|--color-)" +
  "(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|grey|zinc|neutral|stone)" +
  "-(?!light\\b|lighter\\b|dark\\b|darker\\b)[a-z0-9]+";

const COLOR_TOKEN_MESSAGE =
  "Use production hue tokens (bg-red-lighter, text-green-darker, var(--color-blue-dark), …). " +
  "No raw Tailwind numeric shades (bg-red-50) and no invalid shades like -default. " +
  "Valid shades: base | light | lighter | dark | darker. See DESIGN.md.";

// SVP-257: cursor-affordance guard. shadcn's <Button> base + DrawerLink now
// bake `cursor-pointer` into the primitive, so any UI that wants a pointer
// affordance should route through them. This rule catches raw interactive
// elements that bypass the primitives without setting a cursor utility:
// raw `<button>`, `[role="button"]`, and `<div onClick>`. False positives are
// rare and addressable with `// eslint-disable-next-line cursor-affordance/require-cursor`
// + a one-line reason — but the first instinct should be "use the primitive".
//
// Implemented as a small inline plugin rather than `no-restricted-syntax`
// because the equivalent esquery selector (`:has(... :matches(Literal,
// TemplateElement))` + `:not(...)`) is O(descendants × matchers) and pushed
// `npm run lint` over 12 minutes on this codebase. The plugin visits each
// JSXOpeningElement once and walks its own attributes — sub-second.
const CURSOR_MESSAGE =
  "Interactive element missing a `cursor-` utility. Prefer the <Button> or " +
  "DrawerLink primitive (they bake in cursor-pointer). If you must hand-roll, " +
  "add cursor-pointer to the className. See CLAUDE.md → Conventions.";

function classNameHasCursor(attrValue) {
  if (!attrValue) return false;
  if (attrValue.type === "Literal") {
    return typeof attrValue.value === "string" && attrValue.value.includes("cursor-");
  }
  if (attrValue.type === "JSXExpressionContainer") {
    return expressionContainsCursor(attrValue.expression);
  }
  return false;
}

function expressionContainsCursor(node) {
  if (!node) return false;
  switch (node.type) {
    case "Literal":
      return typeof node.value === "string" && node.value.includes("cursor-");
    case "TemplateLiteral":
      return (
        node.quasis.some((q) => q.value.raw.includes("cursor-")) ||
        node.expressions.some(expressionContainsCursor)
      );
    case "BinaryExpression":
    case "LogicalExpression":
      return (
        expressionContainsCursor(node.left) ||
        expressionContainsCursor(node.right)
      );
    case "ConditionalExpression":
      return (
        expressionContainsCursor(node.consequent) ||
        expressionContainsCursor(node.alternate)
      );
    case "CallExpression":
      // cn("cursor-pointer", ...), clsx(...), twMerge(...), etc.
      return node.arguments.some(expressionContainsCursor);
    case "ArrayExpression":
      return node.elements.some(expressionContainsCursor);
    case "ObjectExpression":
      return node.properties.some(
        (p) => p.type === "Property" && expressionContainsCursor(p.key),
      );
    case "TemplateElement":
      return node.value.raw.includes("cursor-");
    default:
      return false;
  }
}

const cursorAffordancePlugin = {
  rules: {
    "require-cursor": {
      meta: {
        type: "problem",
        docs: { description: CURSOR_MESSAGE },
        schema: [],
        messages: { missing: CURSOR_MESSAGE },
      },
      create(context) {
        return {
          JSXOpeningElement(node) {
            // Only check intrinsic JSX (lowercase): <button>, <div>, <span>, …
            // Custom components (<Button>, <DrawerLink>) own their own cursor.
            if (node.name.type !== "JSXIdentifier") return;
            const tag = node.name.name;
            if (tag[0] !== tag[0].toLowerCase()) return;

            let className = null;
            let roleIsButton = false;
            let hasOnClick = false;
            for (const attr of node.attributes) {
              if (attr.type !== "JSXAttribute" || !attr.name) continue;
              const attrName = attr.name.name;
              if (attrName === "className") className = attr.value;
              else if (attrName === "onClick") hasOnClick = true;
              else if (
                attrName === "role" &&
                attr.value &&
                attr.value.type === "Literal" &&
                attr.value.value === "button"
              ) {
                roleIsButton = true;
              }
            }

            const isTriggered =
              tag === "button" ||
              roleIsButton ||
              (tag === "div" && hasOnClick);
            if (!isTriggered) return;
            if (classNameHasCursor(className)) return;

            context.report({ node, messageId: "missing" });
          },
        };
      },
    },
  },
};

// SVP-258: text-xs guard. CLAUDE.md: body / labels / table cells / drawer
// body all live at text-base (15px). `text-xs` (12px) is reserved for `kbd`
// and rare tight chrome (avatar initials, count badges). De-emphasis is via
// muted color, not smaller size — so a new `text-xs` outside that allowlist
// is almost always a typography-ladder violation.
// Note: the trailing `\\/` matches Tailwind opacity modifiers (e.g.
// `text-xs/80`) — escaped so esquery's `/.../`-delimited selector parses.
const TEXT_XS_TOKEN = "(?:^|\\s)text-xs(?:$|\\s|\\/)";
const TEXT_XS_MESSAGE =
  "Avoid text-xs (12px). De-emphasize via text-muted-foreground at body size. " +
  "text-xs is only allowed in tight chrome (kbd, avatar initials, count badges, font-mono IDs); " +
  "if you genuinely need it, add the file to the text-xs allowlist in eslint.config.mjs.";

// STOP — text-xs allowlist drift. Per CLAUDE.md the allowlist should be ~5
// files (avatar, kbd, count-badge). Today it is ~15: legitimate tight chrome
// PLUS files whose text-xs uses are known violations awaiting other-task
// fixes (workspace home, entity-popover, columns-control, layout-toggle, the
// Add-sort buttons in sort-control, etc — see design-reviews/2026-05-29-review-1.md).
// As those tasks land, prune their files from the allowlist so the guard
// becomes strict. New files added here should be tight-chrome only.
const TEXT_XS_ALLOWLIST = [
  // Legitimate tight chrome — keep these.
  "src/components/shared/avatar.tsx", // avatar initials
  "src/components/shared/tag.tsx", // tag chip
  "src/components/shared/entity-pill.tsx", // count badge (SVP-261 → CountChip)
  "src/components/shared/entity-toolbar.tsx", // count chip (SVP-261)
  "src/components/shared/relation-tabs.tsx", // count chip (SVP-261)
  "src/components/responses/response-feed-card.tsx", // notification count badge
  "src/components/coaching/message-bubble.tsx", // timestamp tabular-nums chrome
  "src/components/tickets/ticket-activity.tsx", // hover timestamp chrome
  "src/lib/properties/**", // font-mono ID display across property registries

  // Pending fix by other tasks — prune as those PRs land.
  "src/app/(workspace)/page.tsx", // workspace home body copy — design review
  "src/components/shell/search-palette.tsx", // keyboard hint bar + loading dots + result metadata
  "src/components/shell/workspace-switcher.tsx", // safety net; lint hot-path is the GroupHeading swap
  "src/components/shared/columns-control.tsx", // Show all / Hide all action buttons — design review
  "src/components/shared/sort-control.tsx", // Add-sort button chrome (lines 208/408) — design review
  "src/components/shared/layout-toggle.tsx", // toggle button chrome — design review
  "src/components/shared/entity-popover.tsx", // popover metadata — SVP-260
  "src/components/reports/ai-prompt-dialog.tsx", // helper label + suggestion chips — design review
  "src/components/surveys/survey-detail.tsx", // metadata — design review
  "src/lib/properties/response-answers.tsx", // inline chip (line 66) — pending de-dup
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // SVP-256: production-palette guard. Scoped to first-party source, excluding
  // shadcn primitives (unmodified upstream), tests, mockups (allowed to break
  // the rules), and the /design audit surfaces (they quote token names as
  // documentation string literals).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/components/ui/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "src/app/mockups/**",
      "src/app/(workspace)/design/**",
      "src/lib/design-reviews/**",
    ],
    plugins: {
      "cursor-affordance": cursorAffordancePlugin,
    },
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=/${BAD_COLOR_TOKEN}/]`,
          message: COLOR_TOKEN_MESSAGE,
        },
        {
          selector: `TemplateElement[value.raw=/${BAD_COLOR_TOKEN}/]`,
          message: COLOR_TOKEN_MESSAGE,
        },
      ],
      "cursor-affordance/require-cursor": "error",
    },
  },
  // SVP-258: text-xs typography guard. Same file scoping as the color guard,
  // plus the allowlist above for legitimate tight-chrome (and the
  // pending-fix files until the other tasks land).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/components/ui/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "src/app/mockups/**",
      "src/app/(workspace)/design/**",
      "src/lib/design-reviews/**",
      ...TEXT_XS_ALLOWLIST,
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=/${TEXT_XS_TOKEN}/]`,
          message: TEXT_XS_MESSAGE,
        },
        {
          selector: `TemplateElement[value.raw=/${TEXT_XS_TOKEN}/]`,
          message: TEXT_XS_MESSAGE,
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
