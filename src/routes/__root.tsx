import { useEffect } from "react";
import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Radio" },
      { name: "mobile-web-app-capable", content: "yes" },
      { title: "Radio" },
      { name: "description", content: "StreamShare Radio is a web-based application for live audio streaming and interactive chat." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Radio" },
      { property: "og:description", content: "StreamShare Radio is a web-based application for live audio streaming and interactive chat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Radio" },
      { name: "twitter:description", content: "StreamShare Radio is a web-based application for live audio streaming and interactive chat." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/36deaf0e-0e65-4e9b-9f9e-fc47a9146c92/id-preview-446bd4b1--51a02f3d-796b-42ed-9b29-78d4ab8a7108.lovable.app-1776662053844.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/36deaf0e-0e65-4e9b-9f9e-fc47a9146c92/id-preview-446bd4b1--51a02f3d-796b-42ed-9b29-78d4ab8a7108.lovable.app-1776662053844.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  // F30: Apply saved theme before first paint to avoid flash
  const themeScript = `
    (function(){
      var t = localStorage.getItem('theme') || 'dark';
      document.documentElement.classList.toggle('dark', t === 'dark');
    })();
  `;
  return (
    <html lang="en">
      <head>
        <HeadContent />
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return <Outlet />;
}
