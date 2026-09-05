import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";

const APP_NAME = "Stomp Lab";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
      { title: APP_NAME },
      {
        name: "description",
        content: "Research any song. Get a Line 6 preset that sounds like the record.",
      },
      { name: "theme-color", content: "#F3EFE6" },
      { name: "apple-mobile-web-app-title", content: "StompLab" },
      { name: "application-name", content: "StompLab" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Oswald:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  component: Root,
});

function Root() {
  return (
    <html lang="en" className="light antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <CanonicalHost />
        <PreviewHostBridge />
        <AuthProvider>
          <ShellSwitch />
          <Toaster />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

function CanonicalHost() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hostname === "www.stomplab.app") {
      const next = new URL(window.location.href);
      next.hostname = "stomplab.app";
      window.location.replace(next.toString());
    }
  }, []);
  return null;
}

function ShellSwitch() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const bare = pathname === "/login" || pathname === "/upgrade";
  if (bare) return <Outlet />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
