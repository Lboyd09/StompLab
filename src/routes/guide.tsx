import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { FREE_BUILD_LINE, PAID_BUILD_LINE } from "@/lib/copy";
import { MIN_PASSWORD_LENGTH, RESET_TOKEN_MINUTES } from "@/lib/password-policy";

export const Route = createFileRoute("/guide")({ component: GuidePage });

function GuidePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <PageHeader kicker="How it works" title="How to use Stomp Lab">
        Type a song, download the file, import it on your unit.
      </PageHeader>

      <Section title="Four steps">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Pick your unit and Guitar or Bass in the header.</li>
          <li>Open a demo, or type a song and build it.</li>
          <li>Download the file. It is .hlx for Helix and HX units, .pgp for POD Go.</li>
          <li>
            Import it in HX Edit (POD Go Edit for POD Go): File → Import, don’t drag it. Then put the
            unit in Snapshot mode.
          </li>
        </ol>
      </Section>

      <Section title="Questions">
        <Faq q="My unit isn't in the list">
          <p>Helix Rack or Helix Native: pick Helix Floor. POD Go Wireless: pick POD Go. Helix Stadium isn’t supported yet. Their files import the same way.</p>
        </Faq>
        <Faq q="Which switch is which part?">
          <p>
            Snapshot mode, in song order. HX Stomp: FS1, FS2, FS3. HX Stomp XL, HX Effects, POD Go:
            FS5, FS6, FS2, FS3. Helix Floor and LT: FS8 to FS11, then FS2 to FS5. The preset page
            shows the switch on each part.
          </p>
        </Faq>
        <Faq q="Snapshot or Stomp mode?">
          <p>
            Snapshot mode is song parts: verse, chorus, solo. Stomp mode is one effect per switch. Pick
            the one you want above the download button, and put the unit in the same mode (press PAGE,
            or MODE on XL, until the screen says SNAP or STOMP). If a snapshot does nothing, the unit is
            still in Stomp mode.
          </p>
        </Faq>
        <Faq q="What about wah?">
          <p>
            By default a wah stays your own pedal, in front of the unit. To use the modeler’s wah on
            the expression pedal or a footswitch, pick it in Settings or on the preset page. Songs
            without a wah part don’t show the option.
          </p>
        </Faq>
        <Faq q="How do invites work?">
          <p>
            Signed-in accounts get an invite link. A friend who creates a new account with it (first 48
            hours, before they build a custom song) gets 3 extra custom builds, and so do you. Cap 3
            friends. If you both pay monthly, you each get 50% off one monthly invoice. Yearly stays $69.
          </p>
        </Faq>
        <Faq q="What does it cost?">
          <p>
            Demos are free for everyone. {FREE_BUILD_LINE} Then subscribe: $6.99/month or $69/year.{" "}
            {PAID_BUILD_LINE} Manage or cancel in Account → Manage subscription.
          </p>
        </Faq>
        <Faq q="Billing or support">
          <p>
            Email{" "}
            <a href="mailto:stomplab1@gmail.com" className="text-primary underline underline-offset-2">
              stomplab1@gmail.com
            </a>
            . Polar handles cards and invoices.
          </p>
        </Faq>
      </Section>

      <section id="troubleshoot" className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="sl-hero-title text-2xl text-foreground">If something isn’t working</h2>
        <Faq q="Sign in or forgot password">
          <p>
            Use the email you signed up with. New passwords need {MIN_PASSWORD_LENGTH}+ characters.
            Forgot it? Request a reset from{" "}
            <Link to="/login" className="text-primary underline underline-offset-2">
              Sign in
            </Link>{" "}
            or Account. The link expires in {RESET_TOKEN_MINUTES} minutes.
          </p>
        </Faq>
        <Faq q="Research is busy">
          <p>Wait a minute and try again. The three demos still work.</p>
        </Faq>
        <Faq q="HX Edit doesn’t recognize the preset">
          <p>
            File → Import, don’t drag onto a setlist. Use firmware 3.80 or newer. After import, press
            PAGE until the screen says SNAP or STOMP.
          </p>
        </Faq>
        <Faq q="Snapshots don’t change the sound">
          <p>
            Put the unit in Snapshot mode (PAGE until it says SNAP), then press the part’s switch.
          </p>
        </Faq>
        <Faq q="The wah doesn’t sweep">
          <p>
            Your own wah lives in front of the unit. To use the modeler’s wah, pick it on the preset
            page, then download again.
          </p>
        </Faq>
        <Faq q="DSP is in the red">
          <p>
            Drop a cab, a second delay, or a heavy amp. The percentage is a guide. The unit is the
            authority.
          </p>
        </Faq>
      </section>

      <section id="privacy" className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-display text-lg font-semibold text-foreground">Privacy</h2>
        <p>
          We store the email you sign in with, the presets you build, and Polar’s payment ids so the Lab
          can unlock on the next visit. We do not sell that list. Polar is the merchant of record for
          subscriptions and stores card details — Stomp Lab never sees your card. Song research is sent
          to Google Gemini. You can ask us to delete your
          account by emailing stomplab1@gmail.com.
        </p>
      </section>

      <section id="legal" className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-display text-lg font-semibold text-foreground">Legal</h2>
        <p>
          Stomp Lab is an independent research tool. It is not affiliated with, endorsed by, or
          sponsored by Line 6, Yamaha Guitar Group, Inc., or any manufacturer named in the catalog.
          Helix, HX Stomp, HX Stomp XL, HX Effects, POD, and POD Go are trademarks of Yamaha Guitar
          Group, Inc. Other product names identify the gear our models and research refer to.
        </p>
        <p>
          Presets are unofficial starting points — not copies of commercial patches or master
          recordings. Song titles identify the recording we researched.
        </p>
        <p>
          The full agreement is on{" "}
          <Link to="/terms" className="text-primary underline underline-offset-2">
            Terms
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="text-primary underline underline-offset-2">
            Privacy
          </Link>
          . You check a box (your electronic signature) when you create an account and again when you
          subscribe. Paid Lab renews automatically until you cancel from Account → Manage subscription.
        </p>
      </section>

      <p className="text-sm text-muted-foreground">
        <Link to="/" className="text-primary underline underline-offset-2">
          Back to the Lab
        </Link>
        {" · "}
        <Link to="/settings" className="text-primary underline underline-offset-2">
          Settings
        </Link>
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
      <h2 className="sl-hero-title text-2xl text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="border-b border-border pb-3">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-foreground">{q}</summary>
      <div className="space-y-2 pb-1">{children}</div>
    </details>
  );
}
