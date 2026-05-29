/**
 * Add a teammate to a workspace by granting them membership in the workspace's
 * WorkOS Organization. Workspace access is provisioned at /callback from WorkOS
 * org membership, so this is the canonical "add someone to a workspace" path
 * until the in-app invite UI exists.
 *
 * - If the person already has a WorkOS account → creates an active org
 *   membership immediately (no email; access on their next sign-in).
 * - If they don't → sends a WorkOS invitation email to join the org.
 * - Idempotent: no-ops if they're already a member.
 *
 * Usage (env auto-loaded via --env-file):
 *   npm run add:teammate -- <email> <workspace-name> <role>
 *   e.g. npm run add:teammate -- jane@simplesat.io Simplesat admin
 *
 * <workspace-name> matches the WorkOS Organization name (Simplesat / Pronto /
 * Bloom Beauty), case-insensitive. <role> is a WorkOS role slug (admin|member).
 */
import { WorkOS } from "@workos-inc/node";

async function main() {
  const [email, workspaceName, role] = process.argv.slice(2);
  if (!email || !workspaceName || !role) {
    console.error(
      "Usage: npm run add:teammate -- <email> <workspace-name> <role>\n" +
        "  e.g. npm run add:teammate -- jane@simplesat.io Simplesat admin",
    );
    process.exit(1);
  }
  if (!process.env.WORKOS_API_KEY) {
    console.error("WORKOS_API_KEY not set (expected via --env-file=.env.local).");
    process.exit(1);
  }

  const workos = new WorkOS(process.env.WORKOS_API_KEY);

  // Resolve the workspace's WorkOS org by name (case-insensitive).
  const orgs = await workos.organizations.listOrganizations({ limit: 100 });
  const org = orgs.data.find(
    (o) => o.name.toLowerCase() === workspaceName.toLowerCase(),
  );
  if (!org) {
    console.error(
      `No WorkOS organization named "${workspaceName}". Available: ${orgs.data
        .map((o) => o.name)
        .join(", ")}`,
    );
    process.exit(1);
  }

  // Does the person already have a WorkOS account?
  const users = await workos.userManagement.listUsers({ email });
  const user = users.data[0];

  if (!user) {
    const invite = await workos.userManagement.sendInvitation({
      email,
      organizationId: org.id,
      roleSlug: role,
    });
    console.log(
      `No WorkOS account for ${email} — sent an invitation to join ${org.name} as ${role} (invitation ${invite.id}, expires ${invite.expiresAt}).`,
    );
    process.exit(0);
  }

  // Already a member of this org?
  const mems = await workos.userManagement.listOrganizationMemberships({
    userId: user.id,
    organizationId: org.id,
    limit: 1,
  });
  if (mems.data.length > 0) {
    const m = mems.data[0];
    console.log(
      `${email} is already a member of ${org.name} (${m.id}, role ${m.role?.slug}, status ${m.status}) — no-op.`,
    );
    process.exit(0);
  }

  const m = await workos.userManagement.createOrganizationMembership({
    organizationId: org.id,
    userId: user.id,
    roleSlug: role,
  });
  console.log(
    `Added ${email} to ${org.name} as ${m.role?.slug} (membership ${m.id}, status ${m.status}). Access on their next sign-in.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("ERR:", err instanceof Error ? err.message : err);
  process.exit(1);
});
