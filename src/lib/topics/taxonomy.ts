import type { TopicSentiment, TopicTag } from "@/db/schema";

/** Predefined topic taxonomy. Sourced from csv_exports/topics_groups.csv —
 *  matches the production Simplesat list. Topic + group are user-facing
 *  strings; `id` is a stable kebab-case slug used in URLs and DB serialization
 *  (so a label rename doesn't invalidate stored data or shared report URLs). */
export type TopicDef = {
  id: string;
  label: string;
  group: string;
};

export const TOPICS: TopicDef[] = [
  { id: "above-and-beyond", label: "Above and beyond", group: "Proactivity" },
  { id: "account-access", label: "Account access", group: "Organizational account management" },
  { id: "account-cancellation", label: "Account cancellation", group: "Organizational account management" },
  { id: "active-listening", label: "Active listening", group: "Empathy" },
  { id: "appropriate-tone", label: "Appropriate tone", group: "Communication" },
  { id: "audit-and-monitoring", label: "Audit and monitoring", group: "Security and compliance" },
  { id: "billing-clarity", label: "Billing clarity", group: "Billing and payments" },
  { id: "charges", label: "Charges", group: "Billing and payments" },
  { id: "clarity-of-information", label: "Clarity of information", group: "Communication" },
  { id: "communication-frequency", label: "Communication frequency", group: "Communication" },
  { id: "compliance", label: "Compliance", group: "Security and compliance" },
  { id: "consistency", label: "Consistency", group: "Service quality" },
  { id: "courtesy", label: "Courtesy", group: "Communication" },
  { id: "custom-solutions", label: "Custom solutions", group: "Proactivity" },
  { id: "customer-service", label: "Customer service", group: "Service quality" },
  { id: "data-exporting", label: "Data exporting", group: "Data analysis" },
  { id: "data-privacy", label: "Data privacy", group: "Security and compliance" },
  { id: "delivery-timeliness", label: "Delivery timeliness", group: "Order and delivery management" },
  { id: "discounts", label: "Discounts", group: "Billing and payments" },
  { id: "documentation-clarity", label: "Documentation clarity", group: "Documentation" },
  { id: "domain-specific-expertise", label: "Domain specific expertise", group: "Expertise" },
  { id: "e-commerce-site-usability", label: "E-commerce site usability", group: "E-commerce" },
  { id: "effectiveness", label: "Effectiveness", group: "Service quality" },
  { id: "emotional-intelligence", label: "Emotional intelligence", group: "Empathy" },
  { id: "ethical-conduct", label: "Ethical conduct", group: "Professionalism" },
  { id: "feature-demo", label: "Feature demo", group: "Sales" },
  { id: "fitness-center", label: "Fitness center", group: "Custom" },
  { id: "fulfillment", label: "Fulfillment", group: "Order and delivery management" },
  { id: "general-communication", label: "General communication", group: "Communication" },
  { id: "general-professionalism", label: "General professionalism", group: "Professionalism" },
  { id: "helpfulness", label: "Helpfulness", group: "Service quality" },
  { id: "honesty-and-integrity", label: "Honesty and integrity", group: "Communication" },
  { id: "industry-expertise", label: "Industry expertise", group: "Expertise" },
  { id: "invoice-accuracy", label: "Invoice accuracy", group: "Billing and payments" },
  { id: "knowledgeable", label: "Knowledgeable", group: "Expertise" },
  { id: "multilingual-support", label: "Multilingual support", group: "Communication" },
  { id: "online-shopping-experience", label: "Online shopping experience", group: "E-commerce" },
  { id: "order-confirmation", label: "Order confirmation", group: "E-commerce" },
  { id: "organization-account-verification", label: "Organization account verification", group: "Organizational account management" },
  { id: "password-recovery", label: "Password recovery", group: "User account management" },
  { id: "payment", label: "Payment", group: "Billing and payments" },
  { id: "peak-times", label: "Peak times", group: "Operations" },
  { id: "phone-support", label: "Phone support", group: "Customer support" },
  { id: "price", label: "Price", group: "Billing and payments" },
  { id: "product-availability", label: "Product availability", group: "Product" },
  { id: "product-design", label: "Product design", group: "Product" },
  { id: "product-documentation", label: "Product documentation", group: "Product" },
  { id: "product-inquiries", label: "Product inquiries", group: "Product" },
  { id: "product-issue", label: "Product issue", group: "Product" },
  { id: "product-performance", label: "Product performance", group: "Product" },
  { id: "product-repair", label: "Product repair", group: "Product" },
  { id: "product-return", label: "Product return", group: "Product" },
  { id: "product-setup", label: "Product setup", group: "Product" },
  { id: "product-usage", label: "Product usage", group: "Product" },
  { id: "profile-access", label: "Profile access", group: "User account management" },
  { id: "purchase-transaction", label: "Purchase transaction", group: "Sales" },
  { id: "refund-process", label: "Refund process", group: "Billing and payments" },
  { id: "repair-process", label: "Repair process", group: "Service experience" },
  { id: "security", label: "Security", group: "Security and compliance" },
  { id: "setup-and-installation-guides", label: "Setup and installation guides", group: "Documentation" },
  { id: "size-and-fit", label: "Size and fit", group: "Product" },
  { id: "technical-documentation", label: "Technical documentation", group: "Documentation" },
  { id: "technical-support", label: "Technical support", group: "Service quality" },
  { id: "thoroughness", label: "Thoroughness", group: "Service quality" },
  { id: "training-materials", label: "Training materials", group: "Documentation" },
  { id: "trial", label: "Trial", group: "Product" },
  { id: "two-factor-authentication", label: "Two-factor authentication", group: "User account management" },
  { id: "usability", label: "Usability", group: "Product" },
  { id: "user-experience", label: "User experience", group: "Product" },
  { id: "ux-ui", label: "UX/UI", group: "Product" },
  { id: "wait-time", label: "Wait time", group: "Customer support" },
];

export const TOPIC_BY_ID: Record<string, TopicDef> = Object.fromEntries(
  TOPICS.map((t) => [t.id, t]),
);

/** Topic groups in display order. Derived from TOPICS so a new group from a
 *  later taxonomy update appears automatically. */
export const TOPIC_GROUPS: string[] = (() => {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const t of TOPICS) {
    if (!seen.has(t.group)) {
      seen.add(t.group);
      ordered.push(t.group);
    }
  }
  return ordered;
})();

const SENTIMENT_PRIORITY: Record<TopicSentiment, number> = {
  negative: 3,
  neutral: 2,
  positive: 1,
};

/** Roll up per-answer topics into a deduped per-response list.
 *  Same topic with conflicting sentiments resolves to the worst signal
 *  (negative > neutral > positive). */
export function rollupTopics(
  perAnswer: (TopicTag[] | undefined)[],
): TopicTag[] {
  const best = new Map<string, TopicTag>();
  for (const list of perAnswer) {
    if (!list) continue;
    for (const tag of list) {
      const existing = best.get(tag.topic);
      if (
        !existing ||
        SENTIMENT_PRIORITY[tag.sentiment] > SENTIMENT_PRIORITY[existing.sentiment]
      ) {
        best.set(tag.topic, tag);
      }
    }
  }
  return [...best.values()];
}
