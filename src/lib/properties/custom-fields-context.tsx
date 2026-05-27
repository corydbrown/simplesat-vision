"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { CustomerListRow } from "@/db/queries/customers";
import type { TeamMemberListRow } from "@/db/queries/team-members";
import type { CustomFieldDef } from "./custom-fields";
import { buildCustomerProperties } from "./customers";
import { buildTeamMemberProperties } from "./team-members";
import type { Property } from "./types";

/**
 * Carries the active workspace's custom-field defs (serialized on the server
 * in the workspace layout) plus the `showTier` flag down to every client
 * consumer of customer / team-member properties — list views, detail bodies,
 * and the global drawer (all mounted inside the workspace layout).
 */
type CustomFieldsContextValue = {
  customer: CustomFieldDef[];
  teamMember: CustomFieldDef[];
  /** Loyalty tier renders only for Bloom Beauty; false everywhere else. */
  showTier: boolean;
};

const CustomFieldsContext = createContext<CustomFieldsContextValue | null>(
  null,
);

export function CustomFieldsProvider({
  value,
  children,
}: {
  value: CustomFieldsContextValue;
  children: ReactNode;
}) {
  return (
    <CustomFieldsContext.Provider value={value}>
      {children}
    </CustomFieldsContext.Provider>
  );
}

export function useCustomFields(): CustomFieldsContextValue {
  const ctx = useContext(CustomFieldsContext);
  if (!ctx) {
    throw new Error(
      "useCustomFields must be used within a CustomFieldsProvider",
    );
  }
  return ctx;
}

/** Full customer property list for the active workspace (core + custom, tier
 *  gated by workspace). */
export function useCustomerProperties(): Property<CustomerListRow>[] {
  const { customer, showTier } = useCustomFields();
  return useMemo(
    () => buildCustomerProperties(customer, { showTier }),
    [customer, showTier],
  );
}

/** Full team-member property list for the active workspace (core + custom). */
export function useTeamMemberProperties(): Property<TeamMemberListRow>[] {
  const { teamMember } = useCustomFields();
  return useMemo(() => buildTeamMemberProperties(teamMember), [teamMember]);
}
