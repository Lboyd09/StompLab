import { PRICE_MONTHLY_USD, PRICE_YEARLY_USD, PAID_MONTHLY_BUILDS, FREE_BUILDS, PUBLIC_SUPPORT_EMAIL, formatUsd } from "./plan";

/** Bump this when the agreement text changes. Clickwrap stores the version. */
export const LEGAL_VERSION = "2026-09-10";
export const TERMS_PATH = "/terms";
export const PRIVACY_PATH = "/privacy";

export const LEGAL_EFFECTIVE = "September 10, 2026";

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
      "Stomp Lab is an independent web app that researches recorded guitar and bass tones and builds unofficial starting-point presets for Line 6 Helix-family units (HX Stomp, HX Stomp XL, Helix Floor, Helix LT, HX Effects, POD Go).",
      "Stomp Lab is not affiliated with, endorsed by, or sponsored by Line 6, Yamaha Guitar Group, Inc., or any manufacturer, artist, label, or studio named in the catalog or in a preset. Helix, HX Stomp, HX Stomp XL, HX Effects, POD, and POD Go are trademarks of Yamaha Guitar Group, Inc. Other product names are trademarks of their respective owners and are used only to identify the gear our models and research refer to.",
    ],
  },
  {
    id: "account",
    title: "2. Your account",
    body: [
      "You must be 13 or older to create an account. If you are under 18, you confirm a parent or guardian agrees to these terms.",
      "You are responsible for the email and password you use. Sign in at stomplab.app (not www). One email is one account — a second signup is a new account with no history.",
      "We may close an account that abuses research, tries to scrape the catalog, reverse-engineers the research backend, or uses the Lab in a way that would get a reasonable operator sued. Email " +
        PUBLIC_SUPPORT_EMAIL +
        " if you think that was a mistake.",
    ],
  },
  {
    id: "service",
    title: "3. What the Lab does — and what it is not",
    body: [
      "The Lab returns research and a starting-point .hlx / .pgp file. Presets are unofficial. They are not copies of commercial patches, artist signatures, or master recordings. Song titles identify the recording we researched.",
      "We do not promise that a preset will sound identical to a record. Playback, guitar, hands, and the unit all change the result. Use the preset as a reference, then tweak.",
      "Research uses Google Gemini. Song title, artist, instrument, unit, and optional gear notes are sent to Google to build the preset. Do not put personal data in those fields.",
      "Featured demos are hand-built starting points. Custom research is generated. Both can be wrong. Feedback on a preset improves future research; it does not retune a named song for everyone else.",
    ],
  },
  {
    id: "ip",
    title: "4. Your files and our catalog",
    body: [
      "You own the .hlx / .pgp files you download, for your own use on your own unit. You may not resell Stomp Lab presets as a pack, scrape the catalog, or republish our research text as your own product.",
      "The Helix model list, factory ids, and export format are Line 6's. We map public model names to those ids so HX Edit / POD Go Edit will import. We do not grant you any Line 6 license beyond what your own unit and editor already give you.",
    ],
  },
  {
    id: "as-is",
    title: "5. No warranty",
    body: [
      "THE LAB IS PROVIDED “AS IS.” We do not warrant that research will be accurate, that a file will import on every firmware, or that the service will be uninterrupted.",
      "To the fullest extent allowed by law, Stomp Lab and its operator are not liable for indirect, incidental, special, or consequential damages, or for any amount above what you paid us in the 12 months before the claim (or $50 if you have not paid).",
      "Some states do not allow these limits. In those states, our liability is limited to the minimum the law requires.",
    ],
  },
  {
    id: "law",
    title: "6. Law and disputes",
    body: [
      "These terms are governed by the laws of the State of Arizona, without regard to conflict-of-law rules. If a dispute cannot be resolved by email, the state and federal courts in Maricopa County, Arizona have exclusive jurisdiction, except where consumer-protection law in your state says otherwise.",
      "If a court strikes one clause, the rest still apply. We may update these terms; the version and date at the top of /terms is the one that applies. Material changes get a new version number. Continued use after a posted change is acceptance of the new version — a new subscribe still requires a fresh checkbox.",
    ],
  },
  {
    id: "contact",
    title: "7. Contact",
    body: [
      "Questions, billing, locked out, or a broken preset: " + PUBLIC_SUPPORT_EMAIL + ".",
      "Polar is the merchant of record for cards. Polar’s terms also apply to payment.",
    ],
  },
  {
    id: "signature",
    title: "8. Electronic signature",
    body: [
      "Checking the box on Create account or Subscribe is your electronic signature under the federal ESIGN Act and Arizona’s Uniform Electronic Transactions Act. It has the same effect as signing on paper.",
      "We record which version you agreed to and when. In this browser that lives next to the Lab; Polar keeps the payment record for paid plans. A new version of these terms gets a new version number. Signing up again or subscribing again requires a fresh checkbox.",
    ],
  },
  {
    id: "dmca",
    title: "9. Copyright and takedowns",
    body: [
      "Song titles identify the recording we researched. Presets are unofficial starting points — not copies of master recordings, official artist patches, or commercial preset packs.",
      "If you are a rights holder and believe something here infringes, email " +
        PUBLIC_SUPPORT_EMAIL +
        " with the URL, the work, and your contact. We will look at it. We may remove a demo or a cached research result without admitting the claim is valid.",
    ],
  },
];

export const SUBSCRIPTION_SECTIONS: { id: string; title: string; body: string[] }[] = [
  {
    id: "price",
    title: "Subscription, price, and renewal",
    body: [
      `Paid Lab is ${formatUsd(PRICE_MONTHLY_USD)} per month or ${formatUsd(PRICE_YEARLY_USD)} per year. Both plans include ${PAID_MONTHLY_BUILDS} custom builds each calendar month. Featured demos stay free. After you sign in, you get ${FREE_BUILDS} custom songs before you have to subscribe.`,
      "Polar (merchant of record) charges your card. Stomp Lab never sees the card number.",
      "This is an automatic-renewal subscription. Unless you cancel, Polar will charge the same plan again at the then-current price when the period ends — monthly plans every month, yearly plans every year.",
      "Cancel any time from Account → Manage subscription (Polar’s customer portal). Cancellation takes the same path you used to subscribe: online, no phone call required. You keep paid access until the period you already paid for ends. We do not prorate unused days.",
      "If Polar cannot charge a renewal, paid access stops. Builds already exported stay on your unit.",
      "Refunds: if a charge was a mistake or the Lab was down when you paid, email " +
        PUBLIC_SUPPORT_EMAIL +
        " within 14 days. Chargebacks go through Polar.",
    ],
  },
];

export const PRIVACY_SECTIONS: { id: string; title: string; body: string[] }[] = [
  {
    id: "collect",
    title: "What we store",
    body: [
      "Email and password hash (Better Auth). Name if you typed one.",
      "Presets you build, gear locker items, and usage counts so the monthly limit works.",
      "Polar customer / subscription ids so we can unlock the Lab after you pay. Polar stores the card.",
      "Optional feedback you send (rating, what to change). We use that to improve research. We do not put your name on it.",
      "A daily visit ping from the browser so we can count unique days. No ads, no sale of the list.",
    ],
  },
  {
    id: "use",
    title: "What we use it for",
    body: [
      "To run the Lab: sign-in, builds, unlock, support.",
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
