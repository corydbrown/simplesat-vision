import { Mail, MessageCircle, Phone, Share2 } from "lucide-react";
import type { Channel } from "@/db/schema";

const STYLES: Record<Channel, string> = {
  email: "bg-blue-50 text-blue-700 ring-blue-200",
  chat: "bg-violet-50 text-violet-700 ring-violet-200",
  phone: "bg-orange-50 text-orange-700 ring-orange-200",
  social: "bg-pink-50 text-pink-700 ring-pink-200",
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
