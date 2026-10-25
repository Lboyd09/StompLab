import { createFileRoute, redirect } from "@tanstack/react-router";

// The guide lives in Settings now; old links land on that section.
export const Route = createFileRoute("/guide")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", hash: "help" });
  },
});
