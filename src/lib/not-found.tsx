import { Link } from "@tanstack/react-router";
import { Mark } from "@/components/layout/mark";

export function AppNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-md space-y-5 text-center">
        <Mark size="md" className="mx-auto" />
        <p className="sl-kicker">Stomp Lab</p>
        <h1 className="sl-hero-title text-4xl">This page isn’t here.</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          That link is missing or expired. The Lab, the demos, and your account are still at the home page.
        </p>
        <Link
          to="/"
          className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
        >
          Back to the Lab
        </Link>
      </div>
    </main>
  );
}
