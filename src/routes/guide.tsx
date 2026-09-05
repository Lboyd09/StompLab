import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/guide")({ component: GuidePage });

function GuidePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <header className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Tutorial</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">How to use Stomp Lab</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          One idea: look up a song, see it on a Stomp, copy the file onto the real unit. You do not need
          to learn HX Edit first.
        </p>
      </header>

      <Section title="The 30-second path">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Pick Guitar or Bass, and your unit (Stomp, XL, Floor, LT, HX Effects, or POD Go), in the header.</li>
          <li>Open a featured song, or type a title and build a preset.</li>
          <li>Tap Snapshot or Stomp above the replica. Play the switches.</li>
          <li>Download the file. HX Edit imports .hlx; POD Go Edit imports .pgp.</li>
        </ol>
      </Section>

      <Section title="Snapshot, Stomp, Preset">
        <p>
          <strong className="text-foreground">Snapshot</strong> is song sections. Front switches become
          verse / chorus / solo. Most records live here.
        </p>
        <p>
          <strong className="text-foreground">Stomp</strong> is pedals on a board. Each switch turns one
          effect on or off.
        </p>
        <p>
          <strong className="text-foreground">Preset</strong> is walking banks, the way the hardware sits
          when you aren't inside a song. You rarely need it here.
        </p>
        <p>
          The replica is easier than the unit: the three pills above it change mode. On the hardware you
          press PAGE (or MODE on XL) until the display says SNAP or STOMP.
        </p>
      </Section>

      <Section title="The replica is the unit">
        <p>
          Looking down at a real Stomp: LCD on the left, View / Action well beside it, three knobs under
          the screen, volume on the right, three switches along the front edge — numbered 1, 2, 3 left to
          right.
        </p>
        <p>
          XL is wider, like the hardware from above: switches 1–3 on the top row, LCD and the View /
          Action well to their right, switches 4–6 on the bottom row with MODE and TAP next to them.
          Volume is a recessed knob on the rear.
        </p>
        <p>
          1 is always top-left. 2 top-middle, 3 top-right, 4 bottom-left, 5 bottom-middle, 6 bottom-right.
          The .hlx writes those same physical positions onto the unit.
        </p>
      </Section>

      <Section title="Set the switches">
        <p>
          Tap a numbered footswitch on the replica, then tap what it should do. Snapshot mode shows song
          sections. Stomp mode shows effects. That is the whole job.
        </p>
        <p>
          Reset to original puts a featured rig back to the recorded map. Download writes whichever mode
          is selected — Snapshot or Stomp.
        </p>
      </Section>

      <Section title="Get it onto the Stomp">
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            USB from the unit to a computer. Open HX Edit for Helix family, or POD Go Edit for POD Go
            (firmware 3.80 or newer).
          </li>
          <li>
            File → Import. Pick the .hlx (Helix / HX) or .pgp (POD Go). Do not drag it onto a setlist.
          </li>
          <li>Press PAGE on the unit until SNAP or STOMP matches what you downloaded.</li>
          <li>
            Play. Switch 1 is top-left. If a snapshot does nothing, you are still in Stomp mode — PAGE
            once more.
          </li>
        </ol>
      </Section>

      <Section title="Research and builds">
        <p>
          Featured demos (Sandman, Teen Spirit, Comfortably Numb) never need an account and always
          download. Sign in for three free custom songs. After that, subscribe monthly or yearly.
          Opens any song, Create, History, and Gear. Each custom research counts toward your 50
          builds this month — demos never do.
        </p>
        <p>
          Add guitars and amps in Gear first. Research will mention what to grab from your locker. Paid
          lockers sync to your email.
        </p>
      </Section>

      <Section title="Catalog">
        <p>
          Every HX model, filtered by guitar or bass from the header. Find equivalent maps a real
          pedal (TS808, Klon, SVT) to the Line 6 name. Shop links go to Amazon for the
          original gear.
        </p>
      </Section>

      <Section title="Units">
        <p>
          HX Stomp and HX Stomp XL are the battle-tested .hlx exports. Helix Floor, Helix LT, and HX
          Effects use documented device IDs and the same HX model names — HX Effects never includes
          amp or cab. POD Go exports a .pgp for POD Go Edit (not a Helix .hlx).
        </p>
      </Section>

      <section id="help" className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-display text-lg font-semibold text-foreground">Help</h2>
        <p>
          Stuck on a preset, billing, or sign-in? Email{" "}
          <a href="mailto:stomplab1@gmail.com" className="text-primary underline underline-offset-2">
            stomplab1@gmail.com
          </a>
          . That is the Stomp Lab inbox. Polar handles cards and invoices — use Account → Manage
          subscription to change or cancel. Always sign in at{" "}
          <a href="https://stomplab.app" className="text-primary underline underline-offset-2">
            stomplab.app
          </a>{" "}
          (not www, not the Vercel URL).
        </p>
      </section>

      <section id="privacy" className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        <h2 className="font-display text-lg font-semibold text-foreground">Privacy</h2>
        <p>
          We store the email you sign in with, the presets you build, and Polar’s payment ids so the Lab
          can unlock on the next visit. We do not sell that list. Polar is the merchant of record for
          subscriptions and stores card details — Stomp Lab never sees your card. Song research is sent
          to Google Gemini. Amazon shop links use our affiliate tag. You can ask us to delete your
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
          Some links to Amazon are affiliate links. If you buy through them, Stomp Lab
          may earn a commission at no extra cost to you. As an Amazon Associate we earn from
          qualifying purchases.
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
      <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
