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
