import { createRootRoute, HeadContent, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/react";
import appCss from "../styles.css?url";

const APP_NAME = "Stomp Lab";
const ICON_V = "sl14";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
      { title: APP_NAME },
      {
        name: "description",
        content: "Type a song. Get that guitar rig. Unofficial Line 6 presets from recorded guitar and bass tones.",
      },
      { name: "theme-color", content: "#0B0D12" },
      { name: "apple-mobile-web-app-title", content: "StompLab" },
      { name: "application-name", content: "StompLab" },
    ],
    links: [
      // SVG first so Chrome's tab matches the header sticker.
      { rel: "icon", type: "image/svg+xml", href: `/favicon.svg?v=${ICON_V}` },
      { rel: "icon", type: "image/png", sizes: "32x32", href: `/favicon-32.png?v=${ICON_V}` },
      { rel: "icon", type: "image/png", sizes: "16x16", href: `/favicon-16.png?v=${ICON_V}` },
      { rel: "shortcut icon", href: `/favicon.ico?v=${ICON_V}` },
      { rel: "apple-touch-icon", href: "/sl-home-180.png" },
      { rel: "apple-touch-icon", sizes: "167x167", href: "/apple-touch-icon-167x167.png" },
      { rel: "apple-touch-icon", sizes: "152x152", href: "/apple-touch-icon-152x152.png" },
      { rel: "apple-touch-icon", sizes: "120x120", href: "/apple-touch-icon-120x120.png" },
      // Last 180×180 wins on Safari Add to Home Screen. New path busts iOS cache.
      { rel: "apple-touch-icon", sizes: "180x180", href: "/sl-home-180.png" },
      { rel: "apple-touch-icon-precomposed", sizes: "180x180", href: "/sl-home-180.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: `/sl-icon-192.png?v=${ICON_V}` },
      { rel: "icon", type: "image/png", sizes: "512x512", href: `/sl-icon-512.png?v=${ICON_V}` },
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
    <html lang="en" className="dark antialiased" suppressHydrationWarning>
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
        <HostedAnalytics />
        <Scripts />
      </body>
    </html>
  );
}

/** Vercel Web Analytics 404s on loopback preview. Only load it on a real host. */
function HostedAnalytics() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return;
    setOn(true);
  }, []);
  return on ? <Analytics /> : null;
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
  const bare =
    pathname === "/login" ||
    pathname === "/upgrade" ||
    pathname === "/reset-password" ||
    pathname === "/goodbye";
  if (bare) return <Outlet />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
