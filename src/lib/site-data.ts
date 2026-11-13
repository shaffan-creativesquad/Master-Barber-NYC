import logoUrl from "@/assets/master-barber-logo.png";

export const LOGO_URL = logoUrl;

export const BUSINESS = {
  name: "Master Barber NYC",
  short: "Master Barber",
  tagline: "A Cut Above The Rest",
  phone: "(347) 689-9032",
  phoneHref: "tel:+13476899032",
  email: "hello@masterbarbernyc.com",
  address: {
    line1: "169 7th Ave",
    line2: "Brooklyn, NY 11215",
    mapQuery: "169 7th Ave, Brooklyn, NY 11215",
  },
  bookingUrl: "/book",
} as const;

export const LOCATIONS = [
  {
    name: "Park Slope",
    address: "169 7th Ave, Brooklyn, NY 11215",
    mapQuery: "169 7th Ave, Brooklyn, NY 11215",
    phone: "(347) 689-9032",
    phoneHref: "tel:+13476899032",
    hours: [
      { day: "Mon – Fri", time: "9:00 AM – 7:00 PM" },
      { day: "Saturday", time: "Closed" },
      { day: "Sunday", time: "9:00 AM – 7:00 PM" },
    ],
  },
  {
    name: "Downtown",
    address: "66 Bond St, Brooklyn, NY 11217",
    mapQuery: "66 Bond St, Brooklyn, NY 11217",
    phone: "(347) 457-6777",
    phoneHref: "tel:+13474576777",
    hours: [
      { day: "Mon – Fri", time: "9:00 AM – 7:00 PM" },
      { day: "Saturday", time: "Closed" },
      { day: "Sunday", time: "9:00 AM – 7:00 PM" },
    ],
  },
] as const;


export type Service = {
  name: string;
  price: string;
  duration?: string;
  description?: string;
  popular?: boolean;
};

export const HAIRCUT_SERVICES: Service[] = [
  { name: "First Haircut $20", price: "$20", duration: "30 min", description: "New-client special. Any signature haircut for $20 on your first visit.", popular: true },
  { name: "Regular Haircut", price: "$42", duration: "30 min", description: "Classic scissor and clipper cut, tailored to your look and finished clean.", popular: true },
  { name: "Skin Fade", price: "$42", duration: "30 min", description: "A blade-close fade blended seamlessly into a custom top length.", popular: true },
  { name: "Scissor / Layer Cut", price: "$45", duration: "30 min", description: "All-scissor cut with soft layers for texture, movement and length control." },
  { name: "Buzz / Crew Cut", price: "$35", duration: "30 min", description: "One-length clipper cut with clean edges, sharp, low-maintenance, in and out." },
  { name: "Long Hair", price: "$50", duration: "30 min", description: "Detail work for longer lengths, shape, weight and finish that grows out right." },
  { name: "Boys Haircut (under 12)", price: "$35", duration: "30 min", description: "Patient, careful work for young clients. Same craft, calmer chair." },
  { name: "Senior Citizen Cut", price: "$30", duration: "30 min", description: "A refined classic cut with the same unhurried attention." },
  { name: "Cut + Beard Trim", price: "$60", duration: "45 min", description: "The full reset. Signature cut paired with a shaped, lined beard." },
  { name: "Cut + Shave", price: "$70", duration: "45 min", description: "Precision haircut followed by a traditional hot towel straight razor shave." },
];

export const RAZOR_SERVICES: Service[] = [
  { name: "Beard Trim with Razor", price: "$30", duration: "30 min", description: "Shape, line-up and steam. Walk out looking intentional, not overgrown." },
  { name: "Hairline Shape Up", price: "$20", duration: "20 min", description: "A clean line, sharp corners and a fresh perimeter between visits.", popular: true },
  { name: "Hot Towel Shave", price: "$35", duration: "45 min", description: "Warm lather, hot towels, straight razor, cold finish. Old-school ritual.", popular: true },
  { name: "Hot Towel Head Shave", price: "$35", duration: "40 min", description: "Full razor shave for a smooth, polished head, done with unhurried care." },
];

export const SERVICES: Service[] = [...HAIRCUT_SERVICES, ...RAZOR_SERVICES];

export type Membership = {
  id: string;
  name: string;
  tier: "Bronze" | "Silver" | "Gold";
  interval: "monthly" | "annual";
  price: string;
  cadence: string;
  description: string;
  perks: string[];
  featured?: boolean;
  priceNote?: string;
  terms?: string[];
  /** Amount charged per billing cycle, in cents. */
  amountCents: number;
  /** Stripe recurring interval used for the subscription. */
  billingInterval: "month" | "year";
};


import { BILLING_DAY_CHANGE_AT, billingDayForNewMembership, billingDayLabel } from "@/lib/billing-proration";

type PlanId = "bronze-annual" | "silver-monthly" | "gold-monthly" | "silver-annual" | "gold-annual";

/** Prices before midnight Nov 1, 2026 (New York). */
export const OLD_PRICES: Record<PlanId, number> = {
  "bronze-annual": 4999,
  "silver-monthly": 9999,
  "gold-monthly": 12999,
  "silver-annual": 107987,
  "gold-annual": 140389,
};

/** Prices from midnight Nov 1, 2026 (New York). */
export const NEW_PRICES: Record<PlanId, number> = {
  "bronze-annual": 5999,
  "silver-monthly": 12000,
  "gold-monthly": 15000,
  "silver-annual": 129600,
  "gold-annual": 162000,
};

/** True once the Nov 1, 2026 price change is in effect. Evaluated at call time. */
export function isNewPricing(now: Date = new Date()): boolean {
  return now >= BILLING_DAY_CHANGE_AT;
}

export function formatPlanPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Plans with the prices in effect at `now`. Always call at request time. */
export function getMemberships(now: Date = new Date()): Membership[] {
  return buildMemberships(isNewPricing(now));
}

/** Every price each plan has ever been sold at (old + new), for matching by amount. */
export const ALL_PLAN_PRICES: Record<string, number[]> = Object.fromEntries(
  (Object.keys(OLD_PRICES) as PlanId[]).map((id) => [id, [OLD_PRICES[id], NEW_PRICES[id]]]),
);

/** Bronze "from" price string at `now`, e.g. "$49.99". */
export function membershipFromPrice(now: Date = new Date()): string {
  return formatPlanPrice((isNewPricing(now) ? NEW_PRICES : OLD_PRICES)["bronze-annual"]);
}

/** Billing day for a member joining on this New York date. */
export function newMemberBillingDayLabel(now: Date = new Date()): string {
  return billingDayLabel(billingDayForNewMembership(now));
}

function buildMemberships(isNew: boolean): Membership[] {
  const p = isNew ? NEW_PRICES : OLD_PRICES;
  const fmt = (id: PlanId) => formatPlanPrice(p[id]);
  return [
  {
    id: "bronze-annual",
    amountCents: p["bronze-annual"],
    billingInterval: "month",
    name: "Bronze Unlimited",
    tier: "Bronze",
    interval: "monthly",
    price: fmt("bronze-annual"),
    cadence: "per month",
    description: `Unlimited haircuts for one flat monthly price, billed monthly on your signup day (last day in shorter months).`,
    perks: ["Unlimited signature haircuts", "Priority booking at both locations"],
    featured: true,
    priceNote: `${fmt("bronze-annual")}/month — no large upfront payment`,
    terms: [
      "To cancel, members must call the barbershop directly. Online cancellation is not available.",
      "If cancelled at any point, the member is responsible for the full current month plus any remaining balance on the plan.",
      `A cancellation fee equal to one month of membership (${fmt("bronze-annual")}) applies. Minimum term 6 months.`,
    ],
  },
  {
    id: "silver-monthly",
    amountCents: p["silver-monthly"],
    billingInterval: "month",
    name: "Silver Unlimited",
    tier: "Silver",
    interval: "monthly",
    price: fmt("silver-monthly"),
    cadence: "per month",
    description: "Everything in Bronze plus unlimited beard trims, our most popular tier.",
    perks: ["Unlimited haircuts + beard trims", "Priority booking at both locations", "Members-only slots"],
  },
  {
    id: "gold-monthly",
    amountCents: p["gold-monthly"],
    billingInterval: "month",
    name: "Gold Unlimited",
    tier: "Gold",
    interval: "monthly",
    price: fmt("gold-monthly"),
    cadence: "per month",
    description: "The full ritual on tap: unlimited cuts, beard work and hot towel shaves.",
    perks: ["Unlimited haircuts + beard trims", "Unlimited hot towel shaves", "First-choice priority booking"],
  },
  {
    id: "silver-annual",
    amountCents: p["silver-annual"],
    billingInterval: "year",
    name: "Silver Annual",
    tier: "Silver",
    interval: "annual",
    price: fmt("silver-annual"),
    cadence: "per year",
    description: "Silver Unlimited billed annually, cuts + beard work, all year.",
    perks: ["Unlimited haircuts + beard trims", "Priority booking at both locations"],
  },
  {
    id: "gold-annual",
    amountCents: p["gold-annual"],
    billingInterval: "year",
    name: "Gold Annual",
    tier: "Gold",
    interval: "annual",
    price: fmt("gold-annual"),
    cadence: "per year",
    description: "The complete Master Barber experience, locked in for the year.",
    perks: ["Unlimited haircuts + beard trims", "Unlimited hot towel shaves", "First-choice priority booking"],
  },
];
}

export function getWhyChoose(now: Date = new Date()) {
  const from = membershipFromPrice(now);
  return [
  {
    title: "Master-Level Craft",
    body: "Every barber on the floor is trained in classic technique and modern fades. No rushed chairs, no rotating staff.",
  },
  {
    title: "Two Brooklyn Locations",
    body: "Park Slope and Downtown Brooklyn, both owner-operated, both open six days a week for members.",
  },
  {
    title: "Membership That Pays Off",
    body: `Unlimited cuts from ${from}/month. Most members break even in two visits and never look back.`,
  },
  {
    title: "Upscale, Unhurried Room",
    body: "Leather, brass and low lighting. It should feel like a private club, because your grooming deserves one.",
  },
  {
    title: "Precision Every Time",
    body: "Consistent results across barbers, across chairs, across visits. Your part remembered, your fade dialed in.",
  },
  {
    title: "Honest, Transparent Pricing",
    body: "Menu prices are what you pay. No hidden add-ons, no upsell games, just the cut you came in for.",
  },
];
}

export const PROCESS = [
  { step: "01", title: "Reserve Your Chair", body: "Book online in under a minute or call the shop. Members get priority slots at both locations." },
  { step: "02", title: "Consult & Coffee", body: "We sit down, discuss your hair, your week, and the look you're after. Unhurried by design." },
  { step: "03", title: "Master Craft", body: "Precision clipper work, scissor detail, hot towel and finish | done by a barber, not a stylist." },
  { step: "04", title: "Walk Out Sharp", body: "You leave polished, product placed and | if you're a member | already booked for next time." },
];

export const TESTIMONIALS = [
  { quote: "Isaac and his team don't do rushed cuts. It feels like a private club that happens to hand you the best fade in Brooklyn.", name: "Marcus D.", role: "Member since 2021" },
  { quote: "The membership paid for itself in a month. I stopped in twice a week for line-ups before a wedding and never thought about the bill.", name: "Julian R.", role: "Bedford-Stuyvesant" },
  { quote: "I've been to shops in SoHo that charge double for half the attention. This is the real thing.", name: "Andre P.", role: "Clinton Hill" },
  { quote: "The straight razor shave with hot towels is genuinely the best thirty minutes of my week.", name: "Thomas W.", role: "Fort Greene" },
];

export type Faq = { q: string; a: string };

export function getFaqs(now: Date = new Date()): Faq[] {
  return [
  { q: "What's included in the Bronze Unlimited membership?", a: `Unlimited signature haircuts at either Brooklyn location and priority booking, all for ${membershipFromPrice(now)} per month, billed on your signup day each month (last day in shorter months).` },
  { q: "What's the difference between Silver and Gold?", a: "Silver adds unlimited beard trims to your haircuts. Gold adds unlimited hot towel shaves, the full house experience." },
  { q: "Do you take walk-ins?", a: "When a chair is open, yes. We're usually booked out, appointments are the fastest way in, and members always get first choice." },
  { q: "How long does an appointment take?", a: "Between 20 and 45 minutes depending on the service. We don't overbook, so you get the full time and full attention." },
  { q: "Where are your shops?", a: "Park Slope at 169 7th Ave and Downtown at 66 Bond St. Both owner-operated and open six days a week, closed Saturdays." },
  { q: "Do you sell gift cards?", a: "Yes, physical and digital, any amount. Ask at the front desk or call either shop." },
];
}

export const NEIGHBORHOODS = [
  "Bedford-Stuyvesant",
  "Clinton Hill",
  "Fort Greene",
  "Crown Heights",
  "Prospect Heights",
  "Williamsburg",
  "Park Slope",
  "Downtown Brooklyn",
  "Boerum Hill",
  "Cobble Hill",
];

export const POSTS = [
  { slug: "how-to-grow-out-a-cut", title: "How to Grow Out a Haircut Without Looking Like You Did", excerpt: "The between-visit playbook: line-ups, product changes and the exact week to come back in.", date: "March 12, 2026", readTime: "5 min" },
  { slug: "membership-math", title: "Membership Math: When Unlimited Actually Makes Sense", excerpt: "We ran the numbers on how often our members visit. Here's who saves, and who shouldn't sign up.", date: "February 24, 2026", readTime: "4 min" },
  { slug: "beard-oil-truth", title: "The Truth About Beard Oil (From Someone Who Sells It)", excerpt: "What beard oil actually does, when it's a waste of money, and the three we keep on the counter.", date: "January 30, 2026", readTime: "6 min" },
];

export const SITE_URL = "https://masterbarbernyc.com";
export const OG_IMAGE =
  "https://masterbarbernyc.com/__l5e/assets-v1/fea6915e-fa05-47a9-bec3-aef514cf96bd/og-preview.webp";

/** NYC sales tax, added on top of membership and booking charges (not tips). */
export const SALES_TAX_RATE = 0.08875;
export const SALES_TAX_PERCENT = "8.875";
export function withSalesTax(cents: number): number {
  return Math.round(cents * (1 + SALES_TAX_RATE));
}

/** Tip options (tips are never taxed). */
export const TIP_FLAT_CENTS = [500, 1000, 1500];
export const TIP_PERCENTS = [18, 20, 25];
/** Check-in % tips are based on the value of a regular haircut. */
export const CHECKIN_TIP_BASE_CENTS = 4200;
export const tipFromPercent = (baseCents: number, pct: number) => Math.round((baseCents * pct) / 100);
