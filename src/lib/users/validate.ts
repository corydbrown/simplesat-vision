export type WorkspaceRole = "admin" | "member";

export type InviteInput =
  | { ok: true; email: string; role: WorkspaceRole }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parses + normalizes the invite form. Email is trimmed + lowercased; role
 *  must be one of `"admin" | "member"`. Pure — safe to unit-test. */
export function parseInviteInput(formData: FormData): InviteInput {
  const rawEmail = formData.get("email");
  const rawRole = formData.get("role");

  if (typeof rawEmail !== "string" || rawEmail.trim() === "") {
    return { ok: false, error: "Email is required" };
  }
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address" };
  }

  if (typeof rawRole !== "string" || rawRole === "") {
    return { ok: false, error: "Role is required" };
  }
  if (rawRole !== "admin" && rawRole !== "member") {
    return { ok: false, error: "Role must be admin or member" };
  }

  return { ok: true, email, role: rawRole };
}
