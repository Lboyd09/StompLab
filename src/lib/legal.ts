import { PRICE_MONTHLY_USD, PRICE_YEARLY_USD, PAID_MONTHLY_BUILDS, FREE_BUILDS, PUBLIC_SUPPORT_EMAIL, formatUsd, LAUNCH_DISCOUNT_PERCENT, priceMonthlyLaunchUsd } from "./plan";

/** Bump this when the agreement text changes. Clickwrap stores the version. */
export const LEGAL_VERSION = "2026-09-16";
export const TERMS_PATH = "/terms";
export const PRIVACY_PATH = "/privacy";
export const LEGAL_EFFECTIVE = "September 16, 2026";

export function legalAcceptKey() {
  return `stomplab.legal.${LEGAL_VERSION}`;
}

export type LegalKind = "signup" | "subscribe";

export function recordLegalAccept(kind: LegalKind) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(legalAcceptKey());
    const prev = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    prev[kind] = new Date().toISOString();
    prev.version = LEGAL_VERSION;
    window.localStorage.setItem(legalAcceptKey(), JSON.stringify(prev));
  } catch {
    /* ignore */
  }
}

export const TERMS_SECTIONS: { id: string; title: string; body: string[] }[] = [
  {
    id: "who",
    title: "1. Who we are",
    body: [
      "Stomp Lab researches recorded guitar and bass tones and builds unofficial starting-point presets for Line 6 Helix-family units (HX Stomp, HX Stomp XL, Helix Floor, Helix LT, HX Effects, POD Go).",
      "Stomp Lab is not affiliated with, endorsed by, or sponsored by Line 6, Yamaha Guitar Group, Inc., or any manufacturer, artist, or label named here. Helix, HX Stomp, HX Stomp XL, HX Effects, POD, and POD Go are trademarks of Yamaha Guitar Group, Inc. Other product names identify the gear our research refers to.",
    ],
  },
  {
    id: "account",
    title: "2. Your account",
    body: [
      "You must be 13 or older. If you are under 18, a parent or guardian agrees to these terms.",
      "One email is one account. You are responsible for that password.",
      "We may close an account that abuses research, scrapes the catalog, or tries to game invites. Email " +
        PUBLIC_SUPPORT_EMAIL +
        " if you think that was a mistake.",
    ],
  },
  {
    id: "service",
    title: "3. What the Lab does",
    body: [
      "You type a song. We return research and a starting-point .hlx / .pgp file. Presets are unofficial. They are not copies of commercial patches, artist signatures, or master recordings. Song titles identify the recording we researched.",
      "We do not promise a preset will sound identical to a record. Playback, guitar, hands, and the unit all change the result.",
      "Research uses Google Gemini. Song title, artist, instrument, unit, and optional gear notes go to Google. Do not put personal data in those fields.",
      "Featured demos are hand-built. Custom research is generated. Both can be wrong.",
    ],
  },
  {
    id: "cache",
    title: "4. Shared research cache",
    body: [
      "When a custom song is researched, we may store the resulting preset (song title, artist, instrument, unit, and the preset JSON) so the next person who looks up that song does not wait on a new research call.",
      "That cache is not tied to your account. It does not include your email, name, or password. It is not a public library you can browse.",
    ],
  },
  {
    id: "referrals",
    title: "5. Invites",
    body: [
      "You can invite a friend with a personal code. Each of you gets extra custom builds when the invite is used, up to a cap.",
      "Invites only work on a new account, in the first 48 hours, before that account has researched a custom song. You cannot invite yourself, a second account on the same email, or recycle codes. We may void bonus builds that look like abuse.",
    ],
  },
  {
    id: "ip",
    title: "6. Your files and our catalog",
    body: [
      "You own the .hlx / .pgp files you download, for your own use on your own unit. You may not resell Stomp Lab presets as a pack, scrape the catalog, or republish our research as your own product.",
      "The Helix model list and export format are Line 6's. We map public model names to those ids so HX Edit / POD Go Edit will import.",
    ],
  },
  {
    id: "as-is",
    title: "7. No warranty",
    body: [
      "THE LAB IS PROVIDED “AS IS.” We do not warrant that research will be accurate, that a file will import on every firmware, or that the service will be uninterrupted.",
    ],
  },
  {
    id: "refunds",
    title: "8. Refunds and Polar",
    body: [
      "All sales are final. Paid subscriptions are non-refundable. Cancel any time from Account → Manage subscription; you keep the Lab until the period you already paid for ends. We do not prorate unused days.",
      "Polar is the merchant of record for cards. Polar’s terms also apply to payment. Chargebacks go through Polar.",
    ],
  },
  {
    id: "law",
    title: "9. Law and contact",
    body: [
      "These terms are governed by the laws of the State of Arizona. Disputes go to the state and federal courts in Maricopa County, Arizona, except where consumer-protection law in your state says otherwise.",
      "Questions, billing, locked out, or a broken preset: " + PUBLIC_SUPPORT_EMAIL + ".",
      "Checking the box on Create account or Subscribe is your electronic signature under ESIGN and Arizona’s UETA. We record which version you agreed to.",
    ],
  },
  {
    id: "dmca",
    title: "10. Copyright",
    body: [
      "Song titles identify the recording we researched. Presets are unofficial starting points — not copies of master recordings or official artist patches.",
      "If you are a rights holder and believe something here infringes, email " +
        PUBLIC_SUPPORT_EMAIL +
        " with the URL, the work, and your contact. We may remove a demo or a cached result without admitting the claim is valid.",
    ],
  },
];

export const SUBSCRIPTION_SECTIONS: { id: string; title: string; body: string[] }[] = [
  {
    id: "price",
    title: "Subscription, price, and renewal",
    body: [
      `Paid Lab is ${formatUsd(PRICE_MONTHLY_USD)} per month or ${formatUsd(PRICE_YEARLY_USD)} per year. Both plans include ${PAID_MONTHLY_BUILDS} custom builds each calendar month. Featured demos stay free. After you sign in, you get ${FREE_BUILDS} custom songs before you have to subscribe.`,
      `Launch: the first monthly invoice is ${LAUNCH_DISCOUNT_PERCENT}% off — ${formatUsd(priceMonthlyLaunchUsd())} the first month, then ${formatUsd(PRICE_MONTHLY_USD)}/month. Yearly is ${formatUsd(PRICE_YEARLY_USD)} every year — no launch discount on the year plan. Polar charges until you cancel. The monthly discount is once; it does not repeat at renewal.`,
      "Polar (merchant of record) charges your card. Stomp Lab never sees the card number.",
      "This is an automatic-renewal subscription. Unless you cancel, Polar will charge the same plan again at the then-current price when the period ends — monthly plans every month, yearly plans every year.",
      "Cancel any time from Account → Manage subscription (Polar’s customer portal). Cancellation takes the same path you used to subscribe: online, no phone call required. You keep paid access until the period you already paid for ends. We do not prorate unused days.",
      "If Polar cannot charge a renewal, paid access stops. Builds already exported stay on your unit.",
      "All sales are final. Subscriptions are non-refundable, including unused days in the current period. Cancel before renewal if you do not want the next charge. Chargebacks go through Polar.",
    ],
  },
];

export const PRIVACY_SECTIONS: { id: string; title: string; body: string[] }[] = [
  {
    id: "collect",
    title: "What we store",
    body: [
      "Email and password hash (Better Auth). Name if you typed one. Password-reset tokens live for 15 minutes, then they expire.",
      "Presets you build, gear locker items, and usage counts so the monthly limit works.",
      "Anonymized song research (title, artist, instrument, unit, preset JSON) in a shared cache so a song already researched does not call research again. That row is not tied to your account.",
      "Invite codes and redemptions so bonus builds can be granted. We store the two account ids, not a public list of who invited whom.",
      "Polar customer / subscription ids so we can unlock the Lab after you pay. Polar stores the card.",
      "Optional feedback you send (rating, what to change). We use that to improve research. We do not put your name on it.",
      "A daily visit ping from the browser so we can count unique days. No ads, no sale of the list.",
    ],
  },
  {
    id: "use",
    title: "What we use it for",
    body: [
      "To run the Lab: sign-in, builds, unlock, support. Password-reset mail goes only to the address on the account, and only when you ask.",
      "Song research is sent to Google Gemini (song, artist, instrument, unit, gear notes you typed). Google’s Gemini API terms apply to that call.",
      "We do not sell your email. We do not send marketing mail from this product.",
    ],
  },
  {
    id: "keep",
    title: "How long, and how to delete",
    body: [
      "Account and presets stay until you ask us to delete them, or until we close a dead account.",
      "Email " + PUBLIC_SUPPORT_EMAIL + " to delete your account. We will remove the user row, presets, and Polar link we hold. Polar may keep payment records they are required to keep.",
      "Clickwrap acceptances (which version of the terms you agreed to, and when) are stored in this browser so we can show we obtained consent. Clearing site data clears that record on the device.",
    ],
  },
  {
    id: "rights",
    title: "Your rights",
    body: [
      "You can ask for a copy of what we store, correct it, or delete it by emailing " + PUBLIC_SUPPORT_EMAIL + ".",
      "If you are in the EEA/UK you have GDPR rights; if you are in California you have CCPA rights (access, delete, non-discrimination). We do not sell personal information.",
      "The service is operated from the United States. If you use it from elsewhere, you understand data is processed in the US.",
    ],
  },
];
