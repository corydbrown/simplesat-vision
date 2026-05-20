import { Mail, MessageCircle, Phone, Share2 } from "lucide-react";
import type { Channel } from "@/db/schema";

const STYLES: Record<Channel, string> = {
  email: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/20",
  chat: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/20",
  phone: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/20",
  social: "bg-pink-50 text-pink-700 ring-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:ring-pink-500/20",
};

const ICONS: Record<Channel, React.ComponentType<{ size?: number }>> = {
  email: Mail,
  chat: MessageCircle,
  phone: Phone,
  social: Share2,
};

const LABELS: Record<Channel, string> = {
  email: "Email",
  chat: "Chat",
  phone: "Phone",
  social: "Social",
};

export function ChannelPill({ channel }: { channel: Channel }) {
  const Icon = ICONS[channel];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[channel]}`}
    >
      <Icon size={10} />
      {LABELS[channel]}
    </span>
  );
}
