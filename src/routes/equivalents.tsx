import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/equivalents")({
  beforeLoad: () => {
    throw redirect({ to: "/catalog", search: { q: "", cat: "", tab: "find" } });
  },
  component: () => null,
});
