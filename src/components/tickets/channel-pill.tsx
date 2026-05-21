import { Mail, MessageCircle, Phone, Share2 } from "lucide-react";
import type { Channel } from "@/db/schema";

const STYLES: Record<Channel, string> = {
  email: "bg-blue-lighter text-blue-darker",
  chat: "bg-purple-lighter text-purple-darker",
  phone: "bg-yellow-lighter text-yellow-darker",
  social: "bg-teal-lighter text-teal-darker",
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
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium ${STYLES[channel]}`}
    >
      <Icon size={12} />
      {LABELS[channel]}
    </span>
  );
}
