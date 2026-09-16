import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";

export const Route = createFileRoute("/guide")({ component: GuidePage });

function GuidePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <PageHeader kicker="How it works" title="How to use Stomp Lab">
        One idea: look up a song, see it on your unit, copy the file onto the hardware. You do not need
        to learn HX Edit first.
      </PageHeader>

      <Section title="The 30-second path">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Pick Guitar or Bass, and your unit, in the header.</li>
          <li>Open a featured song, or type a title and build a preset.</li>
          <li>Tap Snapshot, Preset, or Stomp above the replica. Play the switches.</li>
          <li>Download the file. HX Edit imports .hlx; POD Go Edit imports .pgp. File → Import — don’t drag it.</li>
        </ol>
      </Section>

      <Section title="Snapshot, Stomp, Preset">
        <p>
          <strong className="text-foreground">Snapshot</strong> is song sections. Verse, chorus, solo —
          as many as your unit holds. HX Stomp has 3. XL, HX Effects, and POD Go have 4. Helix Floor and
          LT have 8. We never write extras.
        </p>
        <p>
          <strong className="text-foreground">Preset</strong> walks the bank — next song, same box. Same
          mode the hardware uses when you aren’t inside a snapshot.
        </p>
        <p>
          <strong className="text-foreground">Stomp</strong> is pedals on a board. Each switch turns one
          effect on or off.
        </p>
        <p>
          The replica’s pills switch all three. Download writes the mode you have selected. On the
          hardware, press PAGE (or MODE on XL) until the display says SNAP, PRESET, or STOMP.
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
          is selected — Snapshot, Preset, or Stomp.
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
          <li>Press PAGE on the unit until SNAP, PRESET, or STOMP matches what you downloaded.</li>
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

      <Section title="Invite a friend">
        <p>
          Every signed-in account gets a link. When a friend creates a <em>new</em> account with it
          (first 48 hours, before they research a custom song), you both get 3 extra custom builds.
          Cap 15 friends. The Lab, Account, Settings, and Upgrade all show the same invite. A link
          lives in the header too.
        </p>
        <p>
          If you are subscribed and they start a monthly plan, their first month is 50% off. If you also
          pay monthly, your next invoice is 50% off too. Yearly stays $75.
        </p>
      </Section>

      <Section title="Wah">
        <p>
          A wah only goes in the Helix chain if you want the modeler to do it — expression pedal or a
          footswitch. If you already own a Cry Baby, Vox, or similar, leave Wah on “I have a wah pedal”
          and plug it in front of the unit. Sandman and Killing in the Name are wah parts; the demos
          leave the block out on purpose.
        </p>
      </Section>

      <Section title="Name the snapshots">
        <p>
          Before you download, rename the snapshots. Those names write onto the unit’s scribble strips.
          Intro and verse that share a chain stay one snapshot — we do not invent a
          switch for a lyric section that sounds the same.
        </p>
      </Section>

      <Section title="Catalog">
        <p>
          Every HX model, filtered by guitar or bass from the header. Find equivalent maps a real
          pedal (TS808, Klon, SVT) to the Line 6 name.
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
          subscription to change or cancel. Sign in at{" "}
          <a href="https://stomplab.app" className="text-primary underline underline-offset-2">
            stomplab.app
          </a>
          .
        </p>
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
      <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
