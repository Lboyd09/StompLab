import { PRICE_MONTHLY_USD, PRICE_YEARLY_USD, PAID_MONTHLY_BUILDS, FREE_BUILDS, PUBLIC_SUPPORT_EMAIL, formatUsd, LAUNCH_DISCOUNT_PERCENT, priceMonthlyLaunchUsd } from "./plan";

/** Bump this when the agreement text changes. Clickwrap stores the version. */
export const LEGAL_VERSION = "2026-09-18";
export const TERMS_PATH = "/terms";
export const PRIVACY_PATH = "/privacy";
export const LEGAL_EFFECTIVE = "September 18, 2026";

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
      "Stomp Lab is operated as a sole proprietorship by an individual based in Arizona, USA, not through a separate company.",
    ],
  },
  {
    id: "account",
    title: "2. Your account",
    body: [
      "You must be 13 or older. If you are under 18, a parent or guardian agrees to these terms.",
      "One email is one account. You are responsible for that password.",
      "We may close an account that abuses research, scrapes the catalog, tries to game invites, breaks the law, harasses another user, or otherwise violates these terms. Email " +
        PUBLIC_SUPPORT_EMAIL +
        " if you think that was a mistake.",
      "Deleting your account requires email confirmation. After you confirm, we keep your records for 14 days, then permanently remove your email, password, payment reference, custom song history, and saved gear list. You cannot create a new account on that email during the 14-day hold. Presets you already exported to your unit are yours and are not affected. If a song you researched remains in the shared research cache (Section 4), it stays there — that cache was never tied to your account to begin with.",
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
      "You can invite a friend with a personal code. Each of you gets extra custom builds when the invite is used, up to a cap of 3 friends.",
      "Invites only work on a new account, in the first 48 hours, before that account has researched a custom song. You cannot invite yourself, a second account on the same email, or recycle codes. We may void bonus builds that look like abuse.",
      "If you have an active monthly subscription and that friend starts a monthly plan, Polar applies 50% off their first monthly invoice and 50% off your next monthly invoice. Polar does not refund a month you already paid. Yearly plans stay full price. Polar is the merchant of record for those discounted invoices.",
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
      'THE LAB IS PROVIDED "AS IS." We do not warrant that research will be accurate, that a file will import on every firmware, or that the service will be uninterrupted.',
    ],
  },
  {
    id: "refunds",
    title: "8. Refunds and Polar",
    body: [
      "All sales are final. Paid subscriptions are non-refundable. Cancel any time from Account → Manage subscription or Account → Cancel subscription; you keep the Lab until the period you already paid for ends. We do not prorate unused days.",
      "Polar is the merchant of record for cards. Polar's terms also apply to payment. Chargebacks go through Polar.",
    ],
  },
  {
    id: "law",
    title: "9. Law and contact",
    body: [
      "These terms are governed by the laws of the State of Arizona. Disputes go to the state and federal courts in Maricopa County, Arizona, except where consumer-protection law in your state says otherwise, and except as Section 15 (arbitration) requires.",
      "Questions, billing, locked out, or a broken preset: " + PUBLIC_SUPPORT_EMAIL + ".",
      "Checking the box on Create account or Subscribe is your electronic signature under ESIGN and Arizona's UETA. We record which version you agreed to.",
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
  {
    id: "liability",
    title: "11. Limitation of liability",
    body: [
      "To the fullest extent allowed by law, Stomp Lab's total liability to you for any claim arising from these terms or your use of the Lab is limited to the amount you paid us in the 12 months before the claim arose. Stomp Lab is not liable for indirect, incidental, or consequential damages — including a damaged unit, lost time, or lost gig income — even if we knew that kind of loss was possible.",
      "Some states or countries don't allow limiting certain damages. If that applies to you, the limits above apply to the extent your local law allows.",
    ],
  },
  {
    id: "indemnify",
    title: "12. You indemnify us",
    body: [
      "You agree to cover Stomp Lab's reasonable legal costs and damages if a third party makes a claim arising from your misuse of the Lab — reselling presets, uploading or submitting infringing material, or violating these terms.",
    ],
  },
  {
    id: "changes",
    title: "13. Changes to these terms",
    body: [
      "We may update these terms. If we make a material change, we'll show a notice the next time you sign in or email the address on your account. Continuing to use the Lab after that means you accept the update. We record which version you agreed to.",
    ],
  },
  {
    id: "international",
    title: "14. International use",
    body: [
      "Stomp Lab is operated from Arizona, USA, and these terms are governed by Arizona law as stated in Section 9, regardless of where you access the Lab from. If you are outside the United States, you are responsible for confirming that using an AI research and preset-generation service is lawful where you live. We do not tailor these terms to the law of any country outside the US.",
    ],
  },
  {
    id: "arbitration",
    title: "15. Dispute resolution — arbitration",
    body: [
      "You and Stomp Lab agree to resolve any dispute through binding individual arbitration rather than in court, except you may bring an individual claim in small-claims court if it qualifies. There is no right or authority for any dispute to be brought as a class, consolidated, or representative action. This section survives even if part of it is found unenforceable, and if the entire arbitration agreement is found unenforceable, disputes go to the courts named in Section 9 instead.",
    ],
  },
  {
    id: "general",
    title: "16. General",
    body: [
      "If any part of these terms is found unenforceable, the rest stays in effect. These terms are the entire agreement between you and Stomp Lab about the Lab, replacing any earlier understanding. We may assign these terms if Stomp Lab is sold or transferred; you may not assign your account. Neither of us is liable for delays or failures caused by something reasonably outside our control (e.g., an outage at Google or Polar).",
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
      "Cancel any time from Account → Cancel subscription, or Account → Manage subscription (Polar's customer portal). Cancellation takes the same path you used to subscribe: online, no phone call required. You keep paid access until the period you already paid for ends. We do not prorate unused days.",
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
      "Invite codes and redemptions so bonus builds can be granted. We store the two account ids, not a public list of who invited whom. Cap is 3 friends per account.",
      "Polar customer / subscription ids so we can unlock the Lab after you pay and so we can mark a subscription canceled until the paid period ends. Polar stores the card.",
      "Optional feedback you send (rating, what to change). We use that to improve research. We do not put your name on it.",
      "A daily visit ping from the browser so we can count unique days. No ads, no sale of the list.",
      "If you ask to delete the account, we email a confirmation link. After you confirm, we keep the canonical email and related Lab records for 14 days so that email cannot open a new free account, then we erase them. Polar may keep payment records they are required to keep.",
    ],
  },
  {
    id: "use",
    title: "What we use it for",
    body: [
      "To run the Lab: sign-in, builds, unlock, support, invites, and the 14-day recreate block after a confirmed delete. Password-reset mail and delete-confirm mail go only to the address on the account, and only when you ask.",
      "Song research is sent to Google Gemini (song, artist, instrument, unit, gear notes you typed). Google's Gemini API terms apply to that call.",
      "We do not sell your email. We do not send marketing mail from this product.",
    ],
  },
  {
    id: "keep",
    title: "How long, and how to delete",
    body: [
      "Account and presets stay until you confirm a delete from Account (we email a link first), or until we close a dead account.",
      "After you confirm delete, records stay for 14 days, then we remove the user row, presets, locker, invites, and Polar link we hold. During those 14 days you cannot create a new account on that email. Polar may keep payment records they are required to keep.",
      "You can also email " + PUBLIC_SUPPORT_EMAIL + " to start a delete.",
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
