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
          <li>Pick Guitar or Bass, and Stomp or XL, in the header.</li>
          <li>Open a featured song, or type a title and build a preset.</li>
          <li>Tap Snapshot or Stomp above the replica. Play the switches.</li>
          <li>Download the .hlx. In HX Edit: File → Import.</li>
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
          <li>USB from the Stomp to a computer. Open HX Edit (firmware 3.80 or newer).</li>
          <li>File → Import. Pick the .hlx. Do not drag it onto a setlist.</li>
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
          download. Sign in for three free custom songs. After that, a one-time unlock ($19 launch)
          opens any song, Create, History, and Gear. Each custom research counts toward your 50
          builds this month — demos never do.
        </p>
        <p>
          Add guitars and amps in Gear first. Research will mention what to grab from your locker. Paid
          lockers sync to your email.
        </p>
      </Section>

      <Section title="Catalog">
        <p>
          Every HX Stomp model, filtered by guitar or bass from the header. Find equivalent maps a real
          pedal (TS808, Klon, SVT) to the Line 6 name.
        </p>
      </Section>

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
