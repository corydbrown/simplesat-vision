import { describe, expect, it } from "vitest";
import { parseInviteInput } from "./validate";

function fd(entries: Record<string, string | null>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    if (v !== null) f.set(k, v);
  }
  return f;
}

describe("parseInviteInput", () => {
  it("accepts valid email + admin role", () => {
    expect(parseInviteInput(fd({ email: "jane@example.com", role: "admin" }))).toEqual({
      ok: true,
      email: "jane@example.com",
      role: "admin",
    });
  });

  it("accepts valid email + member role", () => {
    expect(parseInviteInput(fd({ email: "jane@example.com", role: "member" }))).toEqual({
      ok: true,
      email: "jane@example.com",
      role: "member",
    });
  });

  it("trims whitespace and lowercases the email", () => {
    const r = parseInviteInput(fd({ email: "  Jane@Example.COM  ", role: "member" }));
    expect(r).toEqual({ ok: true, email: "jane@example.com", role: "member" });
  });

  it("rejects missing email", () => {
    expect(parseInviteInput(fd({ role: "member" }))).toEqual({
      ok: false,
      error: "Email is required",
    });
  });

  it("rejects whitespace-only email", () => {
    expect(parseInviteInput(fd({ email: "   ", role: "member" }))).toEqual({
      ok: false,
      error: "Email is required",
    });
  });

  it("rejects malformed email", () => {
    expect(parseInviteInput(fd({ email: "not-an-email", role: "member" }))).toEqual({
      ok: false,
      error: "Enter a valid email address",
    });
  });

  it("rejects missing role", () => {
    expect(parseInviteInput(fd({ email: "a@b.co" }))).toEqual({
      ok: false,
      error: "Role is required",
    });
  });

  it("rejects invalid role slug", () => {
    expect(parseInviteInput(fd({ email: "a@b.co", role: "owner" }))).toEqual({
      ok: false,
      error: "Role must be admin or member",
    });
  });

  it("rejects empty-string role", () => {
    expect(parseInviteInput(fd({ email: "a@b.co", role: "" }))).toEqual({
      ok: false,
      error: "Role is required",
    });
  });
});
