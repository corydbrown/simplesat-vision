"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, ShieldCheck, User as UserIcon, UserMinus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { removeUser, updateUserRole } from "@/lib/users/actions";
import type { WorkspaceRole } from "@/lib/users/validate";

type Props = {
  membershipId: string;
  workosUserId: string;
  email: string;
  role: WorkspaceRole;
  isSelf: boolean;
  workspaceName: string;
};

export function UserRowActions({
  membershipId,
  workosUserId,
  email,
  role,
  isSelf,
  workspaceName,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const onChangeRole = (next: WorkspaceRole) => {
    if (next === role || isPending) return;
    startTransition(async () => {
      const result = await updateUserRole({
        membershipId,
        workosUserId,
        role: next,
      });
      if (!result.ok) {
        toast(result.error);
        return;
      }
      toast(`${email} is now ${next === "admin" ? "an admin" : "a member"}`);
      router.refresh();
    });
  };

  const onRemove = () => {
    setConfirmOpen(false);
    startTransition(async () => {
      const result = await removeUser({ membershipId, workosUserId });
      if (!result.ok) {
        toast(result.error);
        return;
      }
      toast(`Removed ${email}`);
      router.refresh();
    });
  };

  if (isSelf) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <button
              type="button"
              aria-label={`Actions for ${email} (disabled — that's you)`}
              className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md text-muted-foreground/40"
              disabled
            >
              <MoreHorizontal size={16} />
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          You can&apos;t change your own role or remove yourself
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${email}`}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            disabled={isPending}
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {role === "admin" ? (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onChangeRole("member");
              }}
              className="cursor-pointer"
            >
              <UserIcon size={14} />
              Change to member
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onChangeRole("admin");
              }}
              className="cursor-pointer"
            >
              <ShieldCheck size={14} />
              Make admin
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
            className="cursor-pointer"
          >
            <UserMinus size={14} />
            Remove from workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {email}?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose access to {workspaceName} immediately. You can invite
              them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="cursor-pointer"
              onClick={onRemove}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
