"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireWorkspaceAdmin } from "@/lib/workspaces/authz";
import { parseInviteInput } from "@/lib/users/validate";
import {
  createMembership,
  deleteMembership,
  findMembership,
  findUserByEmail,
  resendInvitation as workosResendInvitation,
  revokeInvitation as workosRevokeInvitation,
  sendInvitation,
  updateMembershipRole,
} from "@/lib/users/workos";

export type InviteUserResult =
  | { ok: true; mode: "invitation" | "membership"; email: string }
  | { ok: false; error: string };

export type UserActionResult = { ok: true } | { ok: false; error: string };

const RoleSchema = z.enum(["admin", "member"]);
const WorkosUserIdSchema = z.string().regex(/^user_/, "Invalid WorkOS user id");
const MembershipIdSchema = z.string().regex(/^om_/, "Invalid membership id");
const InvitationIdSchema = z.string().regex(/^invitation_/, "Invalid invitation id");

/** Translates an unknown SDK error into a user-readable message. WorkOS's SDK
 *  errors expose `.message` already (e.g. "User is already a member of this
 *  organization"); we surface that directly when present. */
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** Sync the local `user_workspaces.role` for a workos user, if the row
 *  exists. Best-effort — WorkOS is the source of truth, and `/callback` will
 *  re-reconcile on next sign-in. */
async function syncLocalRole(
  workosUserId: string,
  workspaceId: string,
  role: "admin" | "member",
): Promise<void> {
  try {
    const [u] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.workosId, workosUserId))
      .limit(1);
    if (!u) return;
    await db
      .update(schema.userWorkspaces)
      .set({ role })
      .where(
        and(
          eq(schema.userWorkspaces.userId, u.id),
          eq(schema.userWorkspaces.workspaceId, workspaceId),
        ),
      );
  } catch (err) {
    console.warn("[users] local role sync failed", err);
  }
}

async function deleteLocalMembership(
  workosUserId: string,
  workspaceId: string,
): Promise<void> {
  try {
    const [u] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.workosId, workosUserId))
      .limit(1);
    if (!u) return;
    await db
      .delete(schema.userWorkspaces)
      .where(
        and(
          eq(schema.userWorkspaces.userId, u.id),
          eq(schema.userWorkspaces.workspaceId, workspaceId),
        ),
      );
  } catch (err) {
    console.warn("[users] local membership delete failed", err);
  }
}

/** Invite a user to the active workspace's WorkOS organization. Branches on
 *  whether the email belongs to an existing WorkOS user — if not, sends an
 *  invitation email; if yes (and not already a member), creates the
 *  membership directly. */
export async function inviteUser(
  _prev: InviteUserResult | null,
  formData: FormData,
): Promise<InviteUserResult> {
  const auth = await requireWorkspaceAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = parseInviteInput(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  try {
    const existing = await findUserByEmail(parsed.email);
    if (existing) {
      const membership = await findMembership(existing.id);
      if (membership) {
        return { ok: false, error: "That user is already a member" };
      }
      await createMembership({ userId: existing.id, role: parsed.role });
      revalidatePath("/settings/users");
      return { ok: true, mode: "membership", email: parsed.email };
    }
    await sendInvitation({ email: parsed.email, role: parsed.role });
    revalidatePath("/settings/users");
    return { ok: true, mode: "invitation", email: parsed.email };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Couldn't send invitation. Try again.") };
  }
}

const UpdateRoleSchema = z.object({
  membershipId: MembershipIdSchema,
  workosUserId: WorkosUserIdSchema,
  role: RoleSchema,
});

export async function updateUserRole(input: unknown): Promise<UserActionResult> {
  const auth = await requireWorkspaceAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  let parsed: z.infer<typeof UpdateRoleSchema>;
  try {
    parsed = UpdateRoleSchema.parse(input);
  } catch {
    return { ok: false, error: "Invalid input" };
  }

  if (parsed.workosUserId === auth.workosUserId) {
    return { ok: false, error: "You can't change your own role" };
  }

  try {
    await updateMembershipRole({
      membershipId: parsed.membershipId,
      role: parsed.role,
    });
    await syncLocalRole(parsed.workosUserId, auth.workspaceId, parsed.role);
    revalidatePath("/settings/users");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Couldn't update role. Try again.") };
  }
}

const RemoveUserSchema = z.object({
  membershipId: MembershipIdSchema,
  workosUserId: WorkosUserIdSchema,
});

export async function removeUser(input: unknown): Promise<UserActionResult> {
  const auth = await requireWorkspaceAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  let parsed: z.infer<typeof RemoveUserSchema>;
  try {
    parsed = RemoveUserSchema.parse(input);
  } catch {
    return { ok: false, error: "Invalid input" };
  }

  if (parsed.workosUserId === auth.workosUserId) {
    return { ok: false, error: "You can't remove yourself" };
  }

  try {
    await deleteMembership(parsed.membershipId);
    await deleteLocalMembership(parsed.workosUserId, auth.workspaceId);
    revalidatePath("/settings/users");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Couldn't remove user. Try again.") };
  }
}

const InvitationActionSchema = z.object({ invitationId: InvitationIdSchema });

export async function revokeInvitation(input: unknown): Promise<UserActionResult> {
  const auth = await requireWorkspaceAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  let parsed: z.infer<typeof InvitationActionSchema>;
  try {
    parsed = InvitationActionSchema.parse(input);
  } catch {
    return { ok: false, error: "Invalid input" };
  }

  try {
    await workosRevokeInvitation(parsed.invitationId);
    revalidatePath("/settings/users");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Couldn't revoke invitation. Try again.") };
  }
}

export async function resendInvitation(input: unknown): Promise<UserActionResult> {
  const auth = await requireWorkspaceAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  let parsed: z.infer<typeof InvitationActionSchema>;
  try {
    parsed = InvitationActionSchema.parse(input);
  } catch {
    return { ok: false, error: "Invalid input" };
  }

  try {
    await workosResendInvitation(parsed.invitationId);
    revalidatePath("/settings/users");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Couldn't resend invitation. Try again.") };
  }
}
