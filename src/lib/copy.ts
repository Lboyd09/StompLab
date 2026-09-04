import { PUBLIC_SUPPORT_EMAIL } from "./plan";

export const RIG_DISCLAIMER =
  "These rigs are research and starting points — not a 100% copy of the record. Use them as a reference, then tweak on your unit.";

export const FORGOT_PASSWORD_COPY =
  `Stomp Lab does not email reset links — there is no mailbox that can send from this site. Change your password from Account while signed in. Locked out? Email ${PUBLIC_SUPPORT_EMAIL}.`;

export const LINE6_DISCLAIMER =
  "Stomp Lab is an independent research tool. It is not affiliated with, endorsed by, or sponsored by Line 6, Yamaha Guitar Group, Inc., or any manufacturer named in the catalog. Helix®, HX Stomp®, HX Stomp XL®, HX Effects®, POD®, and POD Go® are trademarks of Yamaha Guitar Group, Inc. Other product names are trademarks of their respective owners and are used only to identify the gear our models and research refer to.";

export const UNOFFICIAL_DISCLAIMER =
  "Presets are unofficial starting points. They are not copies of commercial patches, artist signatures, or master recordings. Song titles identify the recording we researched.";

export const AFFILIATE_DISCLOSURE =
  "Some links to Amazon are affiliate links. If you buy through them, Stomp Lab may earn a commission at no extra cost to you. As an Amazon Associate we earn from qualifying purchases.";

export const AFFILIATE_SETUP =
  "Amazon Associates: 1) Join affiliate-program.amazon.com. 2) Copy your Store ID (looks like yourname-20 — that is the tag). 3) In Vercel → Project → Settings → Environment Variables, set VITE_AMAZON_ASSOCIATE_TAG to that Store ID for Production. 4) Redeploy — Vite bakes VITE_ vars at build time, so saving the env without a redeploy does nothing. 5) /admin should then say “Amazon tag: set”. Shop links must include tag=YOURID&linkCode=ll2. Commissions land in the Amazon Associates dashboard, not Stomp Lab revenue. Polar: $6.99/month and $75/year products as POLAR_PRODUCT_ID_MONTHLY and POLAR_PRODUCT_ID_YEARLY. Never invent a tag or product id in code.";

export const LEGAL_SHORT =
  "Not affiliated with Line 6. Unofficial research tool. Affiliate links may earn a commission.";

export const PRIVACY_SHORT =
  "We store the email you sign in with, the presets you build, and Polar’s payment ids so the Lab can unlock. We do not sell that. Polar is the merchant of record for subscriptions. Research calls go to Google Gemini. Amazon clicks use our affiliate tag.";

export const HELP_COPY = `Questions, billing, locked out, or a broken preset — email ${PUBLIC_SUPPORT_EMAIL}. We read it.`;
