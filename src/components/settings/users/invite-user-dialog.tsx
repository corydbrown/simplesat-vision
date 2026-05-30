"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { inviteUser } from "@/lib/users/actions";
import type { WorkspaceRole } from "@/lib/users/validate";

export function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("member");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const reset = () => {
    setEmail("");
    setRole("member");
    setError(null);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    setError(null);
    const fd = new FormData();
    fd.set("email", email);
    fd.set("role", role);
    startTransition(async () => {
      const result = await inviteUser(null, fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast(
        result.mode === "invitation"
          ? `Invitation sent to ${result.email}`
          : `${result.email} added to the workspace`,
      );
      setOpen(false);
      reset();
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="cursor-pointer">
          <UserPlus size={14} />
          Invite user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>
            If they don&apos;t have an account, we&apos;ll email them an invitation.
            If they do, they&apos;ll get access on their next sign-in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="invite-email" className="text-sm text-muted-foreground">
              Email
            </label>
            <Input
              id="invite-email"
              type="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="text-base"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="invite-role" className="text-sm text-muted-foreground">
              Role
            </label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as WorkspaceRole)}
            >
              <SelectTrigger id="invite-role" className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member" className="cursor-pointer">
                  Member
                </SelectItem>
                <SelectItem value="admin" className="cursor-pointer">
                  Admin
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && (
            <p className="text-sm text-red-dark dark:text-red-light">{error}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!email.trim() || isPending}
              className="cursor-pointer"
            >
              {isPending ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
