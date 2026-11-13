import { isNewPricing, membershipFromPrice } from "@/lib/site-data";
/**
 * Full article bodies for the Journal. Keyed by the slug used in POSTS.
 * Content is written by the shop and grounded in our real service menu,
 * hours and membership pricing.
 */

export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; text: string };

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  isoDate: string;
  readTime: string;
  author: string;
  intro: string;
  blocks: ArticleBlock[];
  takeaways: string[];
};

const BASE_ARTICLES: Article[] = [
  {
    slug: "how-to-grow-out-a-cut",
    title: "How to Grow Out a Haircut Without Looking Like You Did",
    excerpt:
      "The between-visit playbook: line-ups, product changes and the exact week to come back in.",
    date: "March 12, 2026",
    isoDate: "2026-03-12",
    readTime: "5 min",
    author: "Master Barber NYC",
    intro:
      "Growing your hair out is mostly a scheduling problem, not a hair problem. The shape you leave the chair with lasts about two weeks. What happens in weeks three through ten is what decides whether people say you are growing it out or ask if you missed an appointment.",
    blocks: [
      { type: "h2", text: "Week 1 to 2: do nothing" },
      {
        type: "p",
        text: "A fresh cut settles in around day five. Do not touch it, do not chase the neckline with a trimmer at home, and do not switch products. If you are used to a Skin Fade, this is the stage where the grow-out still reads as intentional on its own.",
      },
      { type: "h2", text: "Week 3 to 5: keep the perimeter, lose the fade" },
      {
        type: "p",
        text: "This is where most grow-outs die. The top has enough weight to sit differently, but the sides puff out and the neckline gets fuzzy. The fix is not a haircut, it is a Hairline Shape Up, $20 and about twenty minutes. We clean the perimeter and the neck and leave every bit of length on the sides and top.",
      },
      {
        type: "p",
        text: "Book the shape up roughly every three weeks during a grow-out. It is the single cheapest thing you can do to keep looking deliberate.",
      },
      { type: "h2", text: "Week 6 to 10: change the product, not the cut" },
      {
        type: "p",
        text: "Short hair wants hold. Medium hair wants control and separation. If you are still using the same high-hold matte clay you used on a fade, it will look stiff and clumpy at three inches. Move toward a cream or a light paste, apply it to damp hair rather than dry, and use less than you think.",
      },
      {
        type: "list",
        items: [
          "Damp hair, not soaking, and dry it in the direction you want it to sit.",
          "Half the product you used on the fade, worked through the mid-lengths first.",
          "Skip daily shampoo. Rinse and condition on the off days so the ends stay soft.",
        ],
      },
      { type: "h2", text: "Week 8 to 12: the weight cut" },
      {
        type: "p",
        text: "At some point the sides stop growing down and start growing out. That is the moment for a Scissor / Layer Cut, $45, where we remove bulk behind the ear and above the ear without shortening the visible length. It is the least dramatic haircut we do and the one that saves the most grow-outs.",
      },
      {
        type: "quote",
        text: "Growing it out does not mean staying out of the chair. It means coming in for smaller work.",
      },
      { type: "h2", text: "The awkward stage is real, and it is short" },
      {
        type: "p",
        text: "Every grow-out has three to four weeks where nothing sits right. Push through it with the perimeter clean and the weight controlled and you get to the good part faster. If you are targeting a specific length by a specific date, tell your barber the date. We will plan the trims backwards from it.",
      },
      { type: "h2", text: "A simple schedule that works" },
      {
        type: "list",
        items: [
          "Weeks 3, 6, 9: Hairline Shape Up, $20.",
          "Week 10 to 12: Scissor / Layer Cut, $45, to remove weight.",
          "Every visit: beard shaped at the same time so the whole face reads clean.",
        ],
      },
      {
        type: "p",
        text: "If that cadence sounds like a lot of visits, it is exactly the case where the Bronze Unlimited plan pays for itself. Grow-outs need frequency, and frequency is what the plan is for.",
      },
    ],
    takeaways: [
      "Shape ups, not haircuts, carry a grow-out.",
      "Switch to a lighter product around week six.",
      "Remove weight before you remove length.",
    ],
  },
  {
    slug: "membership-math",
    title: "Membership Math: When Unlimited Actually Makes Sense",
    excerpt:
      "We ran the numbers on how often our members visit. Here's who saves, and who shouldn't sign up.",
    date: "February 24, 2026",
    isoDate: "2026-02-24",
    readTime: "4 min",
    author: "Master Barber NYC",
    intro:
      "An unlimited plan is only a deal if you use it. Here is the arithmetic on our Bronze Unlimited plan against our normal menu prices, so you can decide honestly instead of guessing.",
    blocks: [
      { type: "h2", text: "The two numbers that matter" },
      {
        type: "p",
        text: "Bronze Unlimited is {{FROM}} per month, billed monthly with no large upfront payment. A Regular Haircut or Skin Fade is $42. That means the plan breaks even at {{BREAKEVEN}}.",
      },
      { type: "h2", text: "Where the break-even lands for you" },
      {
        type: "list",
        items: [
          "Every 2 weeks (26 cuts a year): about $1,092 on the menu against {{FROM}} a month on the plan. Clear win.",
          "Every 3 weeks (17 cuts a year): about $714 against {{FROM}} a month. {{W3}}",
          "Every 4 weeks (13 cuts a year): about $546 against {{FROM}} a month. {{W4}}",
          "Every 6 to 8 weeks: pay per visit. The plan is not for you.",
        ],
      },
      {
        type: "p",
        text: "The line is simple: if you sit in a chair more often than once a month, unlimited wins. If you are a once-every-six-weeks person, book as you go and put the money toward a Hot Towel Shave instead.",
      },
      { type: "h2", text: "The part the math misses" },
      {
        type: "p",
        text: "Members visit more often than they planned to, because the decision to come in is already made. Short hair, tight fades and beards all look better on a two-week cycle, and the plan removes the small internal negotiation about whether today is worth $42.",
      },
      {
        type: "quote",
        text: "Members stop asking whether a cut is worth it and start asking when they can come in.",
      },
      { type: "h2", text: "Read the terms before you join" },
      {
        type: "list",
        items: [
          "Cancellation is by phone only. Call the shop directly, there is no online cancellation.",
          "If you cancel at any point, you are responsible for the full current month plus any remaining balance on the annual plan.",
          "The plan is valid at both Brooklyn locations, Park Slope and Downtown.",
        ],
      },
      { type: "h2", text: "Who should sign up" },
      {
        type: "p",
        text: "Sign up if you keep a fade, a buzz, or any short shape that shows growth within two weeks, or if you are mid grow-out and need frequent shape ups. Skip it if you wear length, prefer scissor work every couple of months, or travel most of the year.",
      },
      {
        type: "p",
        text: "Silver and Gold Unlimited exist for members who want more than haircuts included. If you are adding a beard trim or a shave to most visits, price those tiers out with the same arithmetic before you decide.",
      },
    ],
    takeaways: [
      "Bronze breaks even at about 15 cuts a year.",
      "Under one visit a month, pay per cut instead.",
      "Cancellation is by phone and covers the remaining balance.",
    ],
  },
  {
    slug: "beard-oil-truth",
    title: "The Truth About Beard Oil (From Someone Who Sells It)",
    excerpt:
      "What beard oil actually does, when it's a waste of money, and the three we keep on the counter.",
    date: "January 30, 2026",
    isoDate: "2026-01-30",
    readTime: "6 min",
    author: "Master Barber NYC",
    intro:
      "We sell beard oil. We also tell plenty of clients not to buy it. Here is what the stuff does, what it does not do, and how to know which group you are in.",
    blocks: [
      { type: "h2", text: "What beard oil actually does" },
      {
        type: "p",
        text: "Beard oil conditions the skin under the hair and softens coarse growth. That is the whole job. It solves itch, flaking and wiry texture, which is why it feels transformative in the first week if you had any of those problems.",
      },
      { type: "h2", text: "What it does not do" },
      {
        type: "list",
        items: [
          "It does not grow a beard. Density and patchiness are genetics and time.",
          "It does not fix shape. That is a Beard Trim with Razor, $30, and a line that follows your jaw.",
          "It does not hold anything in place. That is balm or wax.",
        ],
      },
      {
        type: "quote",
        text: "Oil is skincare that happens to live in your beard.",
      },
      { type: "h2", text: "When it is a waste of money" },
      {
        type: "p",
        text: "If your beard is under two weeks of growth, oil mostly lands on skin and does very little for the hair. If your skin is oily and you break out along the jaw, a heavy oil will make it worse. And if your beard is long but unshaped, oil will make an untidy beard shiny rather than tidy.",
      },
      { type: "h2", text: "How to use it properly" },
      {
        type: "list",
        items: [
          "Apply after a shower, on damp skin, not dry hair.",
          "Three to five drops for a short beard, six to eight for a full one.",
          "Work it into the skin first with fingertips, then comb it out through the hair.",
          "Once a day is enough. Twice in deep winter.",
        ],
      },
      { type: "h2", text: "Oil, balm or butter" },
      {
        type: "p",
        text: "Oil for skin and softness. Balm for light hold and shape on medium beards. Butter for very coarse, long beards that drink product. Most people need one of the three, not all three, and buying all three is the most common mistake we see.",
      },
      { type: "h2", text: "The three we keep on the counter" },
      {
        type: "p",
        text: "We stock a small rotation rather than a wall of bottles: a light unscented oil for sensitive skin, a mid-weight cedar oil that suits most beards, and a balm for anyone whose beard has passed the two-inch mark. Ask your barber at your next visit and we will hand you the one that matches your skin, not the one with the best label.",
      },
      { type: "h2", text: "Shape first, product second" },
      {
        type: "p",
        text: "No oil rescues a bad outline. Get the cheek line, the neckline and the corners set by a razor, keep them clean every few weeks, and then use oil to keep the skin underneath comfortable. In that order, a $30 beard trim does more than any bottle on the shelf.",
      },
    ],
    takeaways: [
      "Oil conditions skin and softens hair. Nothing else.",
      "Under two weeks of growth, skip it.",
      "Fix the outline before you buy product.",
    ],
  },
];

function fillPricing(text: string, now: Date): string {
  const isNew = isNewPricing(now);
  return text
    .replaceAll("{{FROM}}", membershipFromPrice(now))
    .replaceAll("{{BREAKEVEN}}", isNew ? "roughly 17 haircuts a year, or about one visit every three weeks" : "roughly 14 haircuts a year, or a little more than one visit a month")
    .replaceAll("{{W3}}", isNew ? "Roughly a wash." : "Clear win.")
    .replaceAll("{{W4}}", isNew ? "Pay per visit instead." : "Roughly a wash.");
}

/** Articles with membership prices filled in for `now`. */
export function getArticles(now: Date = new Date()): Article[] {
  return JSON.parse(fillPricing(JSON.stringify(BASE_ARTICLES), now)) as Article[];
}

/** @deprecated use getArticles() — kept for list order/slug lookups. */
export const ARTICLES = BASE_ARTICLES;

export function getArticle(slug: string): Article | undefined {
  return getArticles().find((a) => a.slug === slug);
}
