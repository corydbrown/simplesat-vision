import { faker } from "@faker-js/faker";

/** Custom-attribute definitions for customers and team members.
 *
 *  These are NOT core fields — core fields (name, email, organization, language,
 *  tier, etc.) live as real columns on the schema and have dedicated cells.
 *  Custom attributes live in the `customProperties` JSON bag and are surfaced
 *  in Simplesat's public API as a flat `customAttributes: [{key, value}]`
 *  array.
 *
 *  Important: Simplesat genuinely cannot attribute these values to a specific
 *  integration. The public API, Zendesk push, Intercom webhook, CSV import,
 *  and manual edits all write into the same single namespace. We do NOT tag
 *  defs with a `source` attribute, and we do NOT render "Synced from X" in
 *  the UI — that would be a fiction.
 *
 *  Custom attributes render inside the entity's direct properties section
 *  (alongside email, name, organization, etc.) — there is no separate UI grouping
 *  for custom attributes. They're distinguished from core fields by the
 *  arrows icon, not by a bespoke section header.
 *
 *  These power three things:
 *  - The PropertiesPanel on detail pages (rendered under the entity's own
 *    section)
 *  - EntityTable's column picker (search + drag-to-reorder)
 *  - Reports pivot fields (via json_extract on custom_properties)
 *
 *  The list is intentionally large + sparse: any given customer carries
 *  values for ~25-50 of the ~50-55 keys depending on engagement depth and
 *  account type (B2C vs B2B). Importance 1-5 drives default ordering and
 *  default visibility (>=4 visible by default).
 */

export type CustomFieldDataType =
  | "string"
  | "number"
  | "date"
  | "boolean"
  | "enum";

/** Serializable custom-field descriptor. Carries only plain data so it can
 *  cross the RSC → Client boundary (a server component derives these per
 *  workspace; client components build `Property` objects from them). Render
 *  closures and the seed-time `sample` fn live elsewhere. */
export type CustomFieldDef = {
  id: string;
  label: string;
  dataType: CustomFieldDataType;
  importance: 1 | 2 | 3 | 4 | 5;
  defaultVisible: boolean;
  enumValues?: readonly string[];
};

/** A `CustomFieldDef` plus the seed-time value generator. Only the hardcoded
 *  Bloom arrays below are this shape — `sample` is a function and therefore
 *  NOT serializable, so it must be stripped before defs reach a client
 *  component (see `custom-fields-provider.ts`). */
export type SeedCustomFieldDef = CustomFieldDef & {
  /** Returns a single realistic mock value. Called per customer/team member
   *  during seed; not all customers carry every field (sparseness handled
   *  by the seed loop, not by `sample` itself). */
  sample: () => unknown;
};

function pick<T>(arr: readonly T[]): T {
  return arr[faker.number.int({ min: 0, max: arr.length - 1 })];
}

/** Random ISO date.
 *  Positive `daysBack`: in the past, between 0 and `daysBack` days ago.
 *  Negative `daysBack`: in the future, up to `|daysBack|` days ahead. */
function isoDate(daysBack: number) {
  const offset =
    daysBack >= 0
      ? faker.number.int({ min: 0, max: daysBack })
      : -faker.number.int({ min: 0, max: -daysBack });
  return new Date(Date.now() - offset * 86_400_000).toISOString();
}

// ---------------------------------------------------------------------------
// Shared enums for Bloom Beauty customer attributes.
// ---------------------------------------------------------------------------

const GENDER = ["female", "male", "non-binary", "prefer-not-to-say"] as const;
const AGE_BRACKET = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
const SKIN_TYPE = ["dry", "normal", "oily", "combination", "sensitive"] as const;
const SKIN_TONE = ["fair", "light", "light-medium", "medium", "tan", "deep", "rich"] as const;
const UNDERTONE = ["cool", "neutral", "warm"] as const;
const HAIR_TYPE = ["straight", "wavy", "curly", "coily"] as const;
const PRODUCT_FOCUS = ["skincare", "makeup", "fragrance", "haircare", "tools", "wellness"] as const;
const MARKETING_SEGMENT = [
  "new-customer",
  "active",
  "lapsed",
  "at-risk",
  "high-value",
  "advocate",
] as const;
const SIGNUP_SOURCE = [
  "organic",
  "instagram",
  "tiktok",
  "referral",
  "in-store",
  "partner",
  "paid-search",
  "email",
] as const;
const PAYMENT_METHOD = [
  "credit-card",
  "apple-pay",
  "google-pay",
  "paypal",
  "klarna",
  "afterpay",
  "gift-card",
] as const;
const CONTACT_METHOD = ["email", "sms", "app-push", "phone"] as const;
const PREFERRED_CATEGORY = [
  "skincare",
  "makeup",
  "fragrance",
  "haircare",
  "tools",
  "wellness",
  "men's",
] as const;
const CORPORATE_ACCOUNT_TYPE = [
  "wholesale",
  "corporate-gifting",
  "influencer",
  "partner",
  "press",
] as const;

const BLOOM_STORES = [
  "Bloom NYC SoHo",
  "Bloom NYC Fifth Ave",
  "Bloom LA Beverly Hills",
  "Bloom LA Westfield Century",
  "Bloom Chicago Magnificent Mile",
  "Bloom San Francisco Union Square",
  "Bloom Miami Aventura",
  "Bloom Boston Newbury",
  "Bloom Seattle Downtown",
  "Bloom Austin Domain",
  "Bloom Dallas NorthPark",
  "Bloom Atlanta Buckhead",
  "Bloom London Covent Garden",
  "Bloom Paris Marais",
  "Bloom Toronto Yorkdale",
];

const FOUNDATION_SHADE_PREFIX = ["1", "2", "3", "4", "5", "6"];
const FOUNDATION_SHADE_SUFFIX = ["N", "W", "C", "P"];

const SKIN_CONCERNS = [
  "acne",
  "anti-aging",
  "dryness",
  "redness",
  "hyperpigmentation",
  "dark-circles",
  "fine-lines",
  "uneven-texture",
  "sensitivity",
  "dullness",
];
const HAIR_CONCERNS = [
  "frizz",
  "color-protection",
  "volume",
  "damage-repair",
  "scalp-care",
  "thinning",
  "curl-definition",
  "shine",
];
const FRAGRANCE_FAMILIES = [
  "floral",
  "woody",
  "fresh",
  "citrus",
  "oriental",
  "gourmand",
  "musky",
  "aquatic",
];
const ALLERGY_POOL = [
  "fragrance-free",
  "paraben-free",
  "sulfate-free",
  "nut-allergy",
  "latex-allergy",
  "nickel-allergy",
];
const SAMPLE_PREFERENCES = [
  "skincare-serums",
  "moisturizers",
  "fragrance",
  "lip-products",
  "foundation",
  "haircare",
  "no-samples",
];
const FAVORITE_BRANDS = [
  "Rare Beauty",
  "Drunk Elephant",
  "Glossier",
  "Charlotte Tilbury",
  "Fenty Beauty",
  "Tatcha",
  "Sol de Janeiro",
  "Olaplex",
  "Kiehl's",
  "Estée Lauder",
  "Dior",
  "Chanel",
  "Maison Margiela",
  "Le Labo",
  "Diptyque",
  "Living Proof",
];

// ---------------------------------------------------------------------------
// Customer custom-attribute definitions (~55 entries, ~25-50 per customer).
// ---------------------------------------------------------------------------

export const CUSTOMER_CUSTOM_FIELDS: SeedCustomFieldDef[] = [
  // ---------------------------------------------------------------------- Profile
  {
    id: "gender",
    label: "Gender",
    dataType: "enum",
    enumValues: GENDER,
    importance: 3,
    defaultVisible: false,
    sample: () =>
      faker.helpers.weightedArrayElement([
        { value: "female", weight: 68 },
        { value: "male", weight: 22 },
        { value: "non-binary", weight: 5 },
        { value: "prefer-not-to-say", weight: 5 },
      ]),
  },
  {
    id: "age_bracket",
    label: "Age bracket",
    dataType: "enum",
    enumValues: AGE_BRACKET,
    importance: 3,
    defaultVisible: false,
    sample: () =>
      faker.helpers.weightedArrayElement([
        { value: "18-24", weight: 18 },
        { value: "25-34", weight: 32 },
        { value: "35-44", weight: 24 },
        { value: "45-54", weight: 14 },
        { value: "55-64", weight: 8 },
        { value: "65+", weight: 4 },
      ]),
  },
  {
    id: "city",
    label: "City",
    dataType: "string",
    importance: 3,
    defaultVisible: false,
    sample: () => faker.location.city(),
  },
  {
    id: "state",
    label: "State / region",
    dataType: "string",
    importance: 2,
    defaultVisible: false,
    sample: () => faker.location.state(),
  },
  {
    id: "postal_code",
    label: "Postal code",
    dataType: "string",
    importance: 2,
    defaultVisible: false,
    sample: () => faker.location.zipCode(),
  },
  {
    id: "country",
    label: "Country",
    dataType: "string",
    importance: 3,
    defaultVisible: false,
    sample: () =>
      faker.helpers.weightedArrayElement([
        { value: "United States", weight: 60 },
        { value: "Canada", weight: 10 },
        { value: "United Kingdom", weight: 10 },
        { value: "France", weight: 5 },
        { value: "Germany", weight: 4 },
        { value: "Australia", weight: 5 },
        { value: "Japan", weight: 3 },
        { value: "Mexico", weight: 3 },
      ]),
  },
  {
    id: "preferred_contact_method",
    label: "Preferred contact",
    dataType: "enum",
    enumValues: CONTACT_METHOD,
    importance: 3,
    defaultVisible: false,
    sample: () =>
      faker.helpers.weightedArrayElement([
        { value: "email", weight: 50 },
        { value: "sms", weight: 30 },
        { value: "app-push", weight: 15 },
        { value: "phone", weight: 5 },
      ]),
  },
  {
    id: "birthday_month",
    label: "Birthday month",
    dataType: "enum",
    enumValues: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    importance: 2,
    defaultVisible: false,
    sample: () =>
      pick(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]),
  },

  // ----------------------------------------------------------------- Beauty profile
  {
    id: "skin_type",
    label: "Skin type",
    dataType: "enum",
    enumValues: SKIN_TYPE,
    importance: 5,
    defaultVisible: true,
    sample: () => pick(SKIN_TYPE),
  },
  {
    id: "skin_tone",
    label: "Skin tone",
    dataType: "enum",
    enumValues: SKIN_TONE,
    importance: 4,
    defaultVisible: true,
    sample: () => pick(SKIN_TONE),
  },
  {
    id: "undertone",
    label: "Undertone",
    dataType: "enum",
    enumValues: UNDERTONE,
    importance: 3,
    defaultVisible: false,
    sample: () => pick(UNDERTONE),
  },
  {
    id: "foundation_shade",
    label: "Foundation shade",
    dataType: "string",
    importance: 4,
    defaultVisible: true,
    sample: () => `${pick(FOUNDATION_SHADE_PREFIX)}${faker.number.int({ min: 0, max: 9 })}${pick(FOUNDATION_SHADE_SUFFIX)}`,
  },
  {
    id: "hair_type",
    label: "Hair type",
    dataType: "enum",
    enumValues: HAIR_TYPE,
    importance: 3,
    defaultVisible: false,
    sample: () => pick(HAIR_TYPE),
  },
  {
    id: "skin_concerns",
    label: "Skin concerns",
    dataType: "string",
    importance: 4,
    defaultVisible: true,
    sample: () =>
      faker.helpers
        .arrayElements(SKIN_CONCERNS, faker.number.int({ min: 1, max: 3 }))
        .join(", "),
  },
  {
    id: "hair_concerns",
    label: "Hair concerns",
    dataType: "string",
    importance: 2,
    defaultVisible: false,
    sample: () =>
      faker.helpers
        .arrayElements(HAIR_CONCERNS, faker.number.int({ min: 0, max: 2 }))
        .join(", "),
  },
  {
    id: "fragrance_preferences",
    label: "Fragrance preferences",
    dataType: "string",
    importance: 3,
    defaultVisible: false,
    sample: () =>
      faker.helpers
        .arrayElements(FRAGRANCE_FAMILIES, faker.number.int({ min: 1, max: 3 }))
        .join(", "),
  },
  {
    id: "allergies",
    label: "Allergies / restrictions",
    dataType: "string",
    importance: 4,
    defaultVisible: true,
    sample: () =>
      faker.helpers
        .arrayElements(ALLERGY_POOL, faker.number.int({ min: 0, max: 2 }))
        .join(", "),
  },
  {
    id: "sample_preferences",
    label: "Sample preferences",
    dataType: "string",
    importance: 3,
    defaultVisible: false,
    sample: () =>
      faker.helpers
        .arrayElements(SAMPLE_PREFERENCES, faker.number.int({ min: 1, max: 3 }))
        .join(", "),
  },
  {
    id: "favorite_brands",
    label: "Favorite brands",
    dataType: "string",
    importance: 4,
    defaultVisible: true,
    sample: () =>
      faker.helpers
        .arrayElements(FAVORITE_BRANDS, faker.number.int({ min: 1, max: 4 }))
        .join(", "),
  },
  {
    id: "pro_member",
    label: "Pro / beauty industry",
    dataType: "boolean",
    importance: 3,
    defaultVisible: false,
    sample: () => faker.datatype.boolean({ probability: 0.04 }),
  },
  {
    id: "product_focus",
    label: "Product focus",
    dataType: "enum",
    enumValues: PRODUCT_FOCUS,
    importance: 3,
    defaultVisible: false,
    sample: () => pick(PRODUCT_FOCUS),
  },
  {
    id: "primary_store",
    label: "Primary store",
    dataType: "string",
    importance: 3,
    defaultVisible: false,
    sample: () => pick(BLOOM_STORES),
  },

  // ---------------------------------------------------------------------- Loyalty
  {
    id: "loyalty_points_balance",
    label: "Loyalty points",
    dataType: "number",
    importance: 5,
    defaultVisible: true,
    sample: () => faker.number.int({ min: 0, max: 18000 }),
  },
  {
    id: "loyalty_tier_since",
    label: "Tier since",
    dataType: "date",
    importance: 3,
    defaultVisible: false,
    sample: () => isoDate(720),
  },
  {
    id: "lifetime_spend",
    label: "Lifetime spend",
    dataType: "number",
    importance: 5,
    defaultVisible: true,
    sample: () =>
      faker.helpers.weightedArrayElement([
        { value: faker.number.int({ min: 0, max: 250 }), weight: 30 },
        { value: faker.number.int({ min: 250, max: 750 }), weight: 35 },
        { value: faker.number.int({ min: 750, max: 2500 }), weight: 25 },
        { value: faker.number.int({ min: 2500, max: 10000 }), weight: 10 },
      ]),
  },
  {
    id: "ytd_spend",
    label: "YTD spend",
    dataType: "number",
    importance: 4,
    defaultVisible: true,
    sample: () => faker.number.int({ min: 0, max: 4000 }),
  },
  {
    id: "birthday_gift_redeemed",
    label: "Birthday gift redeemed",
    dataType: "boolean",
    importance: 2,
    defaultVisible: false,
    sample: () => faker.datatype.boolean({ probability: 0.55 }),
  },
  {
    id: "referrals_made",
    label: "Referrals made",
    dataType: "number",
    importance: 3,
    defaultVisible: false,
    sample: () =>
      faker.helpers.weightedArrayElement([
        { value: 0, weight: 70 },
        { value: 1, weight: 15 },
        { value: 2, weight: 8 },
        { value: faker.number.int({ min: 3, max: 12 }), weight: 7 },
      ]),
  },
  {
    id: "last_tier_change_at",
    label: "Last tier change",
    dataType: "date",
    importance: 3,
    defaultVisible: false,
    sample: () => isoDate(540),
  },

  // -------------------------------------------------------------------- Engagement
  {
    id: "account_created_at",
    label: "Account created",
    dataType: "date",
    importance: 3,
    defaultVisible: false,
    sample: () => isoDate(1200),
  },
  {
    id: "app_installed",
    label: "App installed",
    dataType: "boolean",
    importance: 4,
    defaultVisible: true,
    sample: () => faker.datatype.boolean({ probability: 0.62 }),
  },
  {
    id: "app_last_opened_at",
    label: "App last opened",
    dataType: "date",
    importance: 4,
    defaultVisible: true,
    sample: () => isoDate(45),
  },
  {
    id: "email_subscribed",
    label: "Email subscribed",
    dataType: "boolean",
    importance: 4,
    defaultVisible: true,
    sample: () => faker.datatype.boolean({ probability: 0.78 }),
  },
  {
    id: "sms_subscribed",
    label: "SMS subscribed",
    dataType: "boolean",
    importance: 3,
    defaultVisible: false,
    sample: () => faker.datatype.boolean({ probability: 0.45 }),
  },
  {
    id: "push_notifications_enabled",
    label: "Push notifications",
    dataType: "boolean",
    importance: 2,
    defaultVisible: false,
    sample: () => faker.datatype.boolean({ probability: 0.5 }),
  },
  {
    id: "marketing_segment",
    label: "Marketing segment",
    dataType: "enum",
    enumValues: MARKETING_SEGMENT,
    importance: 4,
    defaultVisible: true,
    sample: () =>
      faker.helpers.weightedArrayElement([
        { value: "active", weight: 45 },
        { value: "new-customer", weight: 18 },
        { value: "high-value", weight: 12 },
        { value: "lapsed", weight: 12 },
        { value: "advocate", weight: 8 },
        { value: "at-risk", weight: 5 },
      ]),
  },
  {
    id: "last_email_opened_at",
    label: "Last email opened",
    dataType: "date",
    importance: 2,
    defaultVisible: false,
    sample: () => isoDate(60),
  },
  {
    id: "last_email_clicked_at",
    label: "Last email clicked",
    dataType: "date",
    importance: 3,
    defaultVisible: false,
    sample: () => isoDate(90),
  },
  {
    id: "signup_source",
    label: "Signup source",
    dataType: "enum",
    enumValues: SIGNUP_SOURCE,
    importance: 3,
    defaultVisible: false,
    sample: () =>
      faker.helpers.weightedArrayElement([
        { value: "organic", weight: 22 },
        { value: "instagram", weight: 18 },
        { value: "tiktok", weight: 14 },
        { value: "in-store", weight: 16 },
        { value: "referral", weight: 10 },
        { value: "paid-search", weight: 10 },
        { value: "email", weight: 6 },
        { value: "partner", weight: 4 },
      ]),
  },
  {
    id: "last_in_store_visit_at",
    label: "Last in-store visit",
    dataType: "date",
    importance: 3,
    defaultVisible: false,
    sample: () => isoDate(180),
  },

  // ------------------------------------------------------------ Purchase behavior
  {
    id: "last_purchase_at",
    label: "Last purchase",
    dataType: "date",
    importance: 5,
    defaultVisible: true,
    sample: () => isoDate(90),
  },
  {
    id: "last_purchase_amount",
    label: "Last purchase amount",
    dataType: "number",
    importance: 4,
    defaultVisible: true,
    sample: () =>
      pick([18, 29, 38, 48, 62, 78, 95, 120, 158, 195, 240, 320, 480]),
  },
  {
    id: "total_orders",
    label: "Total orders",
    dataType: "number",
    importance: 4,
    defaultVisible: true,
    sample: () =>
      faker.helpers.weightedArrayElement([
        { value: faker.number.int({ min: 1, max: 3 }), weight: 35 },
        { value: faker.number.int({ min: 4, max: 10 }), weight: 35 },
        { value: faker.number.int({ min: 11, max: 30 }), weight: 22 },
        { value: faker.number.int({ min: 31, max: 80 }), weight: 8 },
      ]),
  },
  {
    id: "avg_order_value",
    label: "Avg order value",
    dataType: "number",
    importance: 3,
    defaultVisible: false,
    sample: () => pick([35, 45, 58, 68, 85, 105, 128, 165, 210]),
  },
  {
    id: "preferred_category",
    label: "Preferred category",
    dataType: "enum",
    enumValues: PREFERRED_CATEGORY,
    importance: 4,
    defaultVisible: true,
    sample: () =>
      faker.helpers.weightedArrayElement([
        { value: "skincare", weight: 35 },
        { value: "makeup", weight: 28 },
        { value: "fragrance", weight: 14 },
        { value: "haircare", weight: 12 },
        { value: "tools", weight: 4 },
        { value: "wellness", weight: 4 },
        { value: "men's", weight: 3 },
      ]),
  },
  {
    id: "returns_count_ytd",
    label: "Returns (YTD)",
    dataType: "number",
    importance: 3,
    defaultVisible: false,
    sample: () =>
      faker.helpers.weightedArrayElement([
        { value: 0, weight: 70 },
        { value: 1, weight: 18 },
        { value: 2, weight: 7 },
        { value: faker.number.int({ min: 3, max: 6 }), weight: 5 },
      ]),
  },
  {
    id: "last_return_at",
    label: "Last return",
    dataType: "date",
    importance: 2,
    defaultVisible: false,
    sample: () => isoDate(180),
  },
  {
    id: "preferred_payment_method",
    label: "Preferred payment",
    dataType: "enum",
    enumValues: PAYMENT_METHOD,
    importance: 2,
    defaultVisible: false,
    sample: () =>
      faker.helpers.weightedArrayElement([
        { value: "credit-card", weight: 50 },
        { value: "apple-pay", weight: 18 },
        { value: "paypal", weight: 10 },
        { value: "klarna", weight: 8 },
        { value: "afterpay", weight: 6 },
        { value: "google-pay", weight: 5 },
        { value: "gift-card", weight: 3 },
      ]),
  },
  {
    id: "wishlist_count",
    label: "Wishlist items",
    dataType: "number",
    importance: 2,
    defaultVisible: false,
    sample: () => faker.number.int({ min: 0, max: 60 }),
  },
  {
    id: "reviews_written",
    label: "Reviews written",
    dataType: "number",
    importance: 2,
    defaultVisible: false,
    sample: () =>
      faker.helpers.weightedArrayElement([
        { value: 0, weight: 60 },
        { value: faker.number.int({ min: 1, max: 5 }), weight: 25 },
        { value: faker.number.int({ min: 6, max: 25 }), weight: 12 },
        { value: faker.number.int({ min: 26, max: 80 }), weight: 3 },
      ]),
  },
  {
    id: "abandoned_cart_count",
    label: "Abandoned carts (90d)",
    dataType: "number",
    importance: 2,
    defaultVisible: false,
    sample: () => faker.number.int({ min: 0, max: 12 }),
  },
  {
    id: "uses_bopis",
    label: "Uses BOPIS",
    dataType: "boolean",
    importance: 2,
    defaultVisible: false,
    sample: () => faker.datatype.boolean({ probability: 0.32 }),
  },

  // -------------------------------------------------------------------------- B2B
  {
    id: "corporate_account_type",
    label: "Account type (B2B)",
    dataType: "enum",
    enumValues: CORPORATE_ACCOUNT_TYPE,
    importance: 3,
    defaultVisible: false,
    sample: () => pick(CORPORATE_ACCOUNT_TYPE),
  },
  {
    id: "corporate_buyer_role",
    label: "Buyer role",
    dataType: "string",
    importance: 2,
    defaultVisible: false,
    sample: () =>
      pick([
        "Buyer",
        "Procurement Manager",
        "Marketing Coordinator",
        "Owner",
        "Gifting Lead",
      ]),
  },
  {
    id: "account_manager_name",
    label: "Account manager",
    dataType: "string",
    importance: 3,
    defaultVisible: false,
    sample: () => faker.person.fullName(),
  },
  {
    id: "purchase_order_count",
    label: "POs YTD",
    dataType: "number",
    importance: 2,
    defaultVisible: false,
    sample: () => faker.number.int({ min: 1, max: 24 }),
  },
  {
    id: "influencer_handle",
    label: "Influencer handle",
    dataType: "string",
    importance: 2,
    defaultVisible: false,
    sample: () => `@${faker.internet.username().toLowerCase()}`,
  },
];

// ---------------------------------------------------------------------------
// Team member custom-attribute definitions (~22 entries, ~8-16 per member).
// ---------------------------------------------------------------------------

const SHIFT = ["Americas-AM", "Americas-PM", "EMEA", "APAC"] as const;
const SCHEDULE_TYPE = ["full-time", "part-time", "seasonal"] as const;
const BEAUTY_ADVISOR_LEVEL = ["BA1", "BA2", "BA3", "Pro Trainer"] as const;
const SPECIALTIES = [
  "skincare",
  "makeup",
  "fragrance",
  "haircare",
  "returns",
  "loyalty",
  "gift-cards",
  "BOPIS",
  "VIP-clienteling",
  "color-match",
];
const LANGUAGES_SPOKEN_POOL = [
  "English",
  "Spanish",
  "French",
  "Mandarin",
  "Cantonese",
  "Korean",
  "Japanese",
  "Portuguese",
  "German",
  "Italian",
  "Arabic",
];
const CERTIFICATIONS = [
  "Beauty Advisor Level 1",
  "Beauty Advisor Level 2",
  "Beauty Advisor Level 3",
  "Fragrance Specialist",
  "Skincare Consultant",
  "Pro Color Match",
  "VIP Clienteling",
  "Loyalty Program Trainer",
];

export const TEAM_MEMBER_CUSTOM_FIELDS: SeedCustomFieldDef[] = [
  // ---------------------------------------------------------------------- Profile
  {
    id: "pronouns",
    label: "Pronouns",
    dataType: "string",
    importance: 3,
    defaultVisible: false,
    sample: () => pick(["she/her", "he/him", "they/them"]),
  },
  {
    id: "hired_at",
    label: "Hired",
    dataType: "date",
    importance: 4,
    defaultVisible: true,
    sample: () => isoDate(1800),
  },
  {
    id: "manager",
    label: "Manager",
    dataType: "string",
    importance: 4,
    defaultVisible: true,
    sample: () => faker.person.fullName(),
  },
  {
    id: "store_assignment",
    label: "Store assignment",
    dataType: "string",
    importance: 4,
    defaultVisible: true,
    sample: () =>
      faker.helpers.weightedArrayElement([
        { value: "Remote (HQ)", weight: 35 },
        ...BLOOM_STORES.map((s) => ({ value: s, weight: 4 })),
      ]),
  },
  {
    id: "office_location",
    label: "Office location",
    dataType: "string",
    importance: 2,
    defaultVisible: false,
    sample: () =>
      pick(["Remote", "New York HQ", "Los Angeles", "London", "Paris", "Toronto"]),
  },

  // --------------------------------------------------------------------- Schedule
  {
    id: "shift",
    label: "Shift",
    dataType: "enum",
    enumValues: SHIFT,
    importance: 4,
    defaultVisible: true,
    sample: () => pick(SHIFT),
  },
  {
    id: "schedule_type",
    label: "Schedule type",
    dataType: "enum",
    enumValues: SCHEDULE_TYPE,
    importance: 3,
    defaultVisible: false,
    sample: () =>
      faker.helpers.weightedArrayElement([
        { value: "full-time", weight: 65 },
        { value: "part-time", weight: 25 },
        { value: "seasonal", weight: 10 },
      ]),
  },
  {
    id: "weekly_hours",
    label: "Weekly hours",
    dataType: "number",
    importance: 2,
    defaultVisible: false,
    sample: () => pick([12, 16, 20, 24, 30, 32, 40]),
  },

  // ----------------------------------------------------------------------- Skills
  {
    id: "specialties",
    label: "Specialties",
    dataType: "string",
    importance: 4,
    defaultVisible: true,
    sample: () =>
      faker.helpers
        .arrayElements(SPECIALTIES, faker.number.int({ min: 1, max: 4 }))
        .join(", "),
  },
  {
    id: "languages_spoken",
    label: "Languages spoken",
    dataType: "string",
    importance: 3,
    defaultVisible: false,
    sample: () =>
      faker.helpers
        .arrayElements(LANGUAGES_SPOKEN_POOL, faker.number.int({ min: 1, max: 3 }))
        .join(", "),
  },
  {
    id: "beauty_advisor_level",
    label: "Beauty Advisor level",
    dataType: "enum",
    enumValues: BEAUTY_ADVISOR_LEVEL,
    importance: 4,
    defaultVisible: true,
    sample: () =>
      faker.helpers.weightedArrayElement([
        { value: "BA1", weight: 40 },
        { value: "BA2", weight: 30 },
        { value: "BA3", weight: 22 },
        { value: "Pro Trainer", weight: 8 },
      ]),
  },
  {
    id: "certifications",
    label: "Certifications",
    dataType: "string",
    importance: 3,
    defaultVisible: false,
    sample: () =>
      faker.helpers
        .arrayElements(CERTIFICATIONS, faker.number.int({ min: 0, max: 3 }))
        .join(", "),
  },
  {
    id: "fragrance_expert",
    label: "Fragrance expert",
    dataType: "boolean",
    importance: 2,
    defaultVisible: false,
    sample: () => faker.datatype.boolean({ probability: 0.18 }),
  },
  {
    id: "skincare_consultant",
    label: "Skincare consultant",
    dataType: "boolean",
    importance: 2,
    defaultVisible: false,
    sample: () => faker.datatype.boolean({ probability: 0.28 }),
  },
  {
    id: "makeup_artist_cert",
    label: "Makeup artist cert",
    dataType: "boolean",
    importance: 2,
    defaultVisible: false,
    sample: () => faker.datatype.boolean({ probability: 0.22 }),
  },

  // ------------------------------------------------------------------ Performance
  {
    id: "monthly_review_score",
    label: "Monthly review",
    dataType: "number",
    importance: 4,
    defaultVisible: true,
    sample: () => faker.number.float({ min: 2.5, max: 5, fractionDigits: 1 }),
  },
  {
    id: "qa_reviewer",
    label: "QA reviewer",
    dataType: "boolean",
    importance: 3,
    defaultVisible: false,
    sample: () => faker.datatype.boolean({ probability: 0.2 }),
  },
  {
    id: "training_hours_ytd",
    label: "Training hours (YTD)",
    dataType: "number",
    importance: 2,
    defaultVisible: false,
    sample: () => faker.number.int({ min: 0, max: 64 }),
  },
  {
    id: "onboarding_buddy",
    label: "Onboarding buddy",
    dataType: "boolean",
    importance: 2,
    defaultVisible: false,
    sample: () => faker.datatype.boolean({ probability: 0.15 }),
  },
  {
    id: "mentors_count",
    label: "People mentored",
    dataType: "number",
    importance: 2,
    defaultVisible: false,
    sample: () => faker.number.int({ min: 0, max: 6 }),
  },
  {
    id: "tickets_handled_ytd",
    label: "Tickets handled (YTD)",
    dataType: "number",
    importance: 3,
    defaultVisible: false,
    sample: () => faker.number.int({ min: 80, max: 4200 }),
  },
];

export const CUSTOMER_CUSTOM_FIELDS_BY_ID: Record<string, SeedCustomFieldDef> =
  Object.fromEntries(CUSTOMER_CUSTOM_FIELDS.map((f) => [f.id, f]));
export const TEAM_MEMBER_CUSTOM_FIELDS_BY_ID: Record<string, SeedCustomFieldDef> =
  Object.fromEntries(TEAM_MEMBER_CUSTOM_FIELDS.map((f) => [f.id, f]));
