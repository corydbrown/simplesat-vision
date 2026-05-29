"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, MoreHorizontal, RefreshCw, X } from "lucide-react";
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
import { useToast } from "@/components/shared/toast";
import { resendInvitation, revokeInvitation } from "@/lib/users/actions";
import { formatRelative } from "@/lib/format";
import type { WorkspaceRole } from "@/lib/users/validate";

type Props = {
  invitationId: string;
  email: string;
  role: WorkspaceRole;
  createdAt: number;
  expired: boolean;
};

export function PendingInvitationRow({
  invitationId,
  email,
  role,
  createdAt,
  expired,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const onResend = () => {
    if (isPending) return;
    startTransition(async () => {
      const result = await resendInvitation({ invitationId });
      if (!result.ok) {
        toast(result.error);
        return;
      }
      toast(`Resent invitation to ${email}`);
      router.refresh();
    });
  };

  const onRevoke = () => {
    setConfirmOpen(false);
    startTransition(async () => {
      const result = await revokeInvitation({ invitationId });
      if (!result.ok) {
        toast(result.error);
        return;
      }
      toast(`Revoked invitation to ${email}`);
      router.refresh();
    });
  };

  return (
    <>
      <tr>
        <td className="px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-muted-foreground">
              <Mail size={14} />
            </div>
            <div className="text-foreground">{email}</div>
          </div>
        </td>
        <td className="px-5 py-3">
          <span className="capitalize text-muted-foreground">{role}</span>
        </td>
        <td className="px-5 py-3 text-muted-foreground">
          {expired ? (
            <span className="text-red-dark dark:text-red-light">Expired</span>
          ) : (
            <>Invited {formatRelative(createdAt)}</>
          )}
        </td>
        <td className="px-5 py-3 text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Actions for invitation to ${email}`}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                disabled={isPending}
              >
                <MoreHorizontal size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  onResend();
                }}
                className="cursor-pointer"
              >
                <RefreshCw size={14} />
                Resend invitation
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setConfirmOpen(true);
                }}
                className="cursor-pointer"
              >
                <X size={14} />
                Revoke invitation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              The invitation link emailed to {email} will stop working
              immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="cursor-pointer"
              onClick={onRevoke}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
