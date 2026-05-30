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

// SVP-280: text-xs allowlist, post-prune. Two groups:
//   1. Legitimate tight chrome — text-xs is the right call here forever.
//      Avatar initials, kbd, count badges, font-mono IDs, h-7 action buttons
//      (tighter than the default Button h-8/text-sm pairing).
//   2. Pending fix — these still use text-xs in places that should be
//      text-base + text-muted-foreground per CLAUDE.md. Each entry names
//      the design-review task that will fix it. Prune as those land.
// New entries should default to (1) only if they're truly tight chrome.
const TEXT_XS_ALLOWLIST = [
  // ---- Legitimate tight chrome ----
  "src/components/shared/avatar.tsx", // avatar initials
  "src/components/shared/tag.tsx", // tag chip
  "src/components/shared/count-chip.tsx", // count chip primitive (SVP-261)
  "src/components/shared/entity-pill.tsx", // remaining tight chip chrome
  "src/components/shared/entity-toolbar.tsx", // toolbar chip chrome
  "src/components/shared/relation-tabs.tsx", // tab count chrome
  "src/components/responses/response-feed-card.tsx", // notification count badge
  "src/components/coaching/message-bubble.tsx", // timestamp tabular-nums chrome
  "src/components/tickets/ticket-activity.tsx", // hover timestamp chrome
  "src/lib/properties/**", // font-mono ID display across property registries
  // Tighter-than-sm action buttons (h-7) — intentionally below Button's
  // default text-sm to fit the smaller hit target. Treat as tight chrome.
  "src/components/shared/sort-control.tsx", // h-7 Add-sort + sort-dir buttons
  "src/components/shared/columns-control.tsx", // h-7 Show all / Hide all
  "src/components/shared/layout-toggle.tsx", // segmented control chrome

  // ---- Pending fix (design-review queue) ----
  "src/app/(workspace)/page.tsx", // workspace home body copy
  "src/components/shell/search-palette.tsx", // keyboard hint + result metadata
  "src/components/shared/entity-popover.tsx", // popover footer metadata — SVP-260 partial
  "src/components/reports/ai-prompt-dialog.tsx", // helper label + suggestion chips
  "src/components/surveys/survey-detail.tsx", // metadata
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
  // SVP-264: ban native `title=` on interactive elements under first-party
  // source. Native tooltip rendering is inconsistent across browsers/OS and
  // inaccessible on touch devices. Use shadcn <Tooltip> for hover content or
  // aria-label alone when the text is a pure a11y hint. Heatmap cells
  // (heatmap.tsx) are explicitly exempted — they use title= on <Link> cells
  // as a data annotation, not a standalone tooltip surface.
  {
    files: [
      "src/components/**/*.{ts,tsx}",
      "src/app/(workspace)/**/*.{ts,tsx}",
    ],
    ignores: ["src/components/shared/heatmap.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXOpeningElement[name.name=/^(button|Button|a|Link)$/] > JSXAttribute[name.name='title']",
          message:
            "Use shadcn <Tooltip> instead of native title= on interactive elements. " +
            "Native tooltips are inaccessible on touch and inconsistent across browsers. " +
            "If the text is a pure a11y hint with no visible-hover value, use aria-label alone.",
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
