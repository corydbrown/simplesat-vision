"use client";

import { useMemo } from "react";

import { useCustomFields } from "@/lib/properties/custom-fields-context";
import type { BaseEntity } from "./types";
import { buildPivotFields, type PivotField } from "./pivot-fields";

/**
 * Workspace-scoped pivot registry for client components (rail, axis picker,
 * report builder). Reads the same `CustomFieldsContext` the workspace layout
 * already fans out (custom-field defs + `showTier`) and memoizes the built
 * record — Bloom gets curated fields + tier, other workspaces get
 * data-derived custom fields and no tier.
 */
export function usePivotFields(): Record<BaseEntity, PivotField[]> {
  const { customer, teamMember, showTier } = useCustomFields();
  return useMemo(
    () =>
      buildPivotFields({
        customerCustomFields: customer,
        teamMemberCustomFields: teamMember,
        showTier,
      }),
    [customer, teamMember, showTier],
  );
}
