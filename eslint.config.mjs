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
