import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/react";
import appCss from "../styles.css?url";

const APP_NAME = "Stomp Lab";
const ICON_V = "sl5";

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
      // PNG/ICO first. apple-touch href must be exactly /icon-192.png (no query)
      // so grok-pwa skips injecting an un-cache-busted /__grok/icon-180.png.
      { rel: "icon", type: "image/png", sizes: "32x32", href: `/favicon-32.png?v=${ICON_V}` },
      { rel: "icon", type: "image/png", sizes: "16x16", href: `/favicon-16.png?v=${ICON_V}` },
      { rel: "shortcut icon", href: `/favicon.ico?v=${ICON_V}` },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: `/icon-192.png?v=${ICON_V}` },
      { rel: "icon", type: "image/png", sizes: "512x512", href: `/icon-512.png?v=${ICON_V}` },
      { rel: "icon", type: "image/svg+xml", href: `/favicon.svg?v=${ICON_V}` },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
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
        <VisitBeacon />
        <PreviewHostBridge />
        <AuthProvider>
          <ShellSwitch />
          <Toaster />
        </AuthProvider>
        <Analytics />
        <Scripts />
      </body>
    </html>
  );
}

/** One ping per browser per day. Bots that do not run JS are not counted. */
function VisitBeacon() {
  useEffect(() => {
    try {
      const day = new Date().toISOString().slice(0, 10);
      const key = "stomplab.visit.day";
      if (window.localStorage.getItem(key) === day) return;
      window.localStorage.setItem(key, day);
    } catch {
      return;
    }
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/visit", new Blob([], { type: "text/plain" }));
        return;
      }
    } catch {
      /* fall through */
    }
    void fetch("/api/visit", { method: "POST", keepalive: true, credentials: "same-origin" }).catch(
      () => undefined,
    );
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
