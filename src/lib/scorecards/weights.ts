/**
 * Pure weight helpers extracted from the scorecard save action. Lives outside
 * `actions.ts` (which is `"use server"`) so unit tests can import them without
 * dragging in the DB stack. The action file re-exports for back-compat.
 */

export type WeightCriterionInput = {
  text: string;
  weightPercent?: number;
};

export type WeightCategoryInput = {
  name: string;
  weightPercent: number;
  isAutofail: boolean;
  criteria: WeightCriterionInput[];
};

export type WeightInput = {
  categories: WeightCategoryInput[];
};

/** Resolve per-criterion weights from the save payload (SVP-228 transitional).
 *  When the editor sends explicit per-criterion weights we use them directly;
 *  when it omits them (pre-SVP-229 client) we split the category's weight
 *  evenly across its non-autofail criteria so the sum-to-100 invariant holds.
 *  Autofail criteria always resolve to 0. */
export function normalizeCriterionWeights(cat: WeightCategoryInput): number[] {
  if (cat.isAutofail) return cat.criteria.map(() => 0);
  const explicit = cat.criteria.map((c) =>
    typeof c.weightPercent === "number" ? c.weightPercent : null,
  );
  const allExplicit = explicit.every((w) => w !== null);
  if (allExplicit) return explicit as number[];
  const count = cat.criteria.length;
  const base = Math.floor(cat.weightPercent / count);
  const remainder = cat.weightPercent - base * count;
  // Distribute the remainder onto the first `remainder` criteria so the sum
  // matches the category weight exactly.
  return cat.criteria.map((_, i) => base + (i < remainder ? 1 : 0));
}

export function validateWeights(input: WeightInput): void {
  const scored = input.categories.filter((c) => !c.isAutofail);
  const sum = scored.reduce((acc, c) => acc + c.weightPercent, 0);
  if (sum !== 100) {
    throw new Error(
      `Category weights must sum to 100 (got ${sum}). Auto-fail categories are excluded.`,
    );
  }
  for (const cat of input.categories) {
    if (cat.isAutofail && cat.weightPercent !== 0) {
      throw new Error(
        `Auto-fail category "${cat.name}" must have weight 0 (got ${cat.weightPercent}).`,
      );
    }
    // SVP-229: when the editor sends explicit per-criterion weights, enforce
    // that they're internally consistent with the category. We require
    // all-or-nothing on per-criterion weights — partial payloads can't be
    // reasoned about and indicate a client bug. The all-omitted path stays
    // handled by `normalizeCriterionWeights`'s even-split shim, so legacy
    // callers keep working.
    const hasAny = cat.criteria.some(
      (c) => typeof c.weightPercent === "number",
    );
    const hasAll = cat.criteria.every(
      (c) => typeof c.weightPercent === "number",
    );
    if (hasAny && !hasAll) {
      throw new Error(
        `Category "${cat.name}" mixes explicit and omitted criterion weights. Send all or none.`,
      );
    }
    if (!hasAll) continue;
    if (cat.isAutofail) {
      const bad = cat.criteria.find((c) => c.weightPercent !== 0);
      if (bad) {
        throw new Error(
          `Auto-fail category "${cat.name}" requires every criterion weight to be 0 (criterion "${bad.text.slice(0, 40)}" was ${bad.weightPercent}).`,
        );
      }
      continue;
    }
    const critSum = cat.criteria.reduce(
      (acc, c) => acc + (c.weightPercent ?? 0),
      0,
    );
    if (critSum !== cat.weightPercent) {
      throw new Error(
        `Criterion weights in "${cat.name}" sum to ${critSum} but category weight is ${cat.weightPercent}. They must match.`,
      );
    }
  }
}
