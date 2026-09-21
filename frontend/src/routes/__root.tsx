import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AppStateProvider } from "@/lib/app-state";
import { SiteHeader, SiteFooter, MobileTabBar } from "@/components/site-shell";

import appCss from "../styles.css?url";
import { BRAND } from "@/lib/brand";

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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MedPath by Vidyarthi Mitra — From your NEET rank to the right seat" },
      {
        name: "description",
        content:
          "NEET-UG counselling guidance: college discovery, cutoffs, AI seat predictor and 1-to-1 expert calls.",
      },
      {
        property: "og:title",
        content: "MedPath by Vidyarthi Mitra — NEET-UG counselling guidance",
      },
      {
        property: "og:description",
        content:
          "From your NEET rank to the right seat. Cutoffs, seat predictor and expert counselling.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: BRAND.fullName },
      { property: "og:image", content: BRAND.socialImage },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: BRAND.fullName },
      { name: "application-name", content: BRAND.fullName },
      { name: "theme-color", content: "#0e8c86" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: BRAND.socialImage },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Inter:wght@400..700&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <BrandMetadata />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function BrandMetadata() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const url = `${BRAND.siteUrl}${pathname}`;
  return (
    <>
      <link rel="canonical" href={url} />
      <meta property="og:url" content={url} />
      {pathname === "/" && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: BRAND.fullName,
              alternateName: BRAND.name,
              url: BRAND.siteUrl,
              description: BRAND.description,
              publisher: {
                "@type": "Organization",
                name: BRAND.company,
                url: BRAND.companyUrl,
                logo: `${BRAND.siteUrl}/brand/vidyarthi-mitra.png`,
              },
            }),
          }}
        />
      )}
    </>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const bare = pathname === "/login" || pathname === "/signup" || pathname.startsWith("/admin");

  return (
    <QueryClientProvider client={queryClient}>
      <AppStateProvider>
        <div className="flex min-h-screen flex-col bg-paper">
          {!bare && <SiteHeader />}
          <main className={bare ? "flex-1" : "flex-1 pb-20 md:pb-0"}>
            {/* Required: nested routes render here. */}
            <Outlet />
          </main>
          {!bare && <SiteFooter />}
          {!bare && <MobileTabBar />}
        </div>
        <Toaster position="top-center" />
      </AppStateProvider>
    </QueryClientProvider>
  );
}
