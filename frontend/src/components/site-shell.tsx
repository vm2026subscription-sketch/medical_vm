import { BrandLogo } from "./brand-logo";
import { BRAND } from "@/lib/brand";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home, Building2, Table2, Sparkles, LayoutDashboard, Menu, X, Bell, Mail, MapPin, MessageCircle, Phone, Instagram, Facebook, Youtube, Linkedin, Twitter, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Btn, BtnLink, Pill } from "@/components/kit";
import { useApp } from "@/lib/app-state";
import { apiRequest } from "@/lib/api-client";

type FooterContact = { type: "phone" | "email" | "whatsapp" | "address"; label: string; value: string; url?: string };
type FooterLink = { icon: "instagram" | "facebook" | "youtube" | "linkedin" | "x" | "website"; label: string; url: string };
type FooterSettings = { contacts: FooterContact[]; links: FooterLink[] };
const emptyFooter: FooterSettings = { contacts: [], links: [] };
const contactIcons = { phone: Phone, email: Mail, whatsapp: MessageCircle, address: MapPin };
const socialIcons = { instagram: Instagram, facebook: Facebook, youtube: Youtube, linkedin: Linkedin, x: Twitter, website: Globe };
function contactHref(contact: FooterContact) {
  if (contact.url) return contact.url;
  if (contact.type === "phone") return `tel:${contact.value.replace(/[^+\d]/g, "")}`;
  if (contact.type === "email") return `mailto:${contact.value}`;
  if (contact.type === "whatsapp") return `https://wa.me/${contact.value.replace(/\D/g, "")}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.value)}`;
}

const nav = [
  { to: "/", label: "Home" },
  { to: "/colleges", label: "Colleges" },
  { to: "/cutoffs", label: "Cutoffs" },
  { to: "/courses", label: "Courses" },
  { to: "/ai-match", label: "AI seat match" },
  { to: "/counselling/book", label: "Counselling" },
  { to: "/compare", label: "Compare" },
];

const mobileNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/colleges", label: "Colleges", icon: Building2 },
  { to: "/cutoffs", label: "Cutoffs", icon: Table2 },
  { to: "/ai-match", label: "AI", icon: Sparkles },
  { to: "/dashboard", label: "Me", icon: LayoutDashboard },
];

export function SiteHeader() {
  const { user, isAuthenticated, authLoading, logout, premium } = useApp();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 md:px-6">
        <Link to="/" aria-label={BRAND.fullName}>
          <BrandLogo />
        </Link>

        <nav className="ml-3 hidden items-center gap-1 xl:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "rounded-full px-2 py-2 text-[13px] font-semibold text-muted transition-colors duration-[180ms] hover:bg-teal-050 hover:text-teal-700",
                (n.to === "/" ? pathname === "/" : pathname.startsWith(n.to)) &&
                  "bg-teal-050 text-teal-700",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/notifications"
            aria-label="Notifications"
            className="relative hidden size-10 items-center justify-center rounded-full text-muted hover:bg-board hover:text-ink sm:flex"
          >
            <Bell className="size-[18px]" strokeWidth={1.6} />
            <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-rose ring-2 ring-card" />
          </Link>
          {!authLoading &&
            (isAuthenticated ? (
              <>
                {user?.role === "admin" && (
                  <BtnLink to="/admin" variant="dark" size="sm">
                    Admin
                  </BtnLink>
                )}
                <BtnLink
                  to="/dashboard"
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex"
                >
                  My account
                </BtnLink>
                <Btn variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={logout}>
                  Log out
                </Btn>
              </>
            ) : (
              <BtnLink to="/login" variant="ghost" size="sm">
                Log in
              </BtnLink>
            ))}
          {!premium && user?.role !== "admin" && (
            <BtnLink to="/upgrade" variant="gold" size="sm" className="hidden sm:inline-flex">
              Unlock ₹99
            </BtnLink>
          )}
          <Btn
            variant="ghost"
            size="sm"
            className="px-2.5 xl:hidden"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <X className="size-4" strokeWidth={1.6} />
            ) : (
              <Menu className="size-4" strokeWidth={1.6} />
            )}
          </Btn>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-card px-4 py-3 xl:hidden">
          <div className="grid gap-1">
            {[
              ...nav,
              ...(user?.role === "admin" ? [{ to: "/admin", label: "Admin console" }] : []),
              { to: "/dashboard", label: "Dashboard" },
              { to: "/upgrade", label: "Plans & payment" },
              { to: "/notifications", label: "Notifications" },
              ...(!isAuthenticated && !authLoading ? [{ to: "/login", label: "Log in" }] : []),
            ].map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded-[12px] px-3 py-2.5 text-sm font-semibold text-ink hover:bg-teal-050"
              >
                {n.label}
              </Link>
            ))}
            {isAuthenticated && (
              <Btn
                variant="ghost"
                onClick={() => {
                  logout();
                  setOpen(false);
                }}
              >
                Log out
              </Btn>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function MobileTabBar() {
  const { user, isAuthenticated } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      <div className="grid grid-cols-5">
        {mobileNav.map((item) => {
          const n =
            item.to === "/dashboard"
              ? {
                  ...item,
                  to: user?.role === "admin" ? "/admin" : isAuthenticated ? "/dashboard" : "/login",
                  label: user?.role === "admin" ? "Admin" : isAuthenticated ? "Me" : "Log in",
                }
              : item;
          const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold",
                active ? "text-teal-700" : "text-muted-2",
              )}
            >
              <n.icon className="size-[19px]" strokeWidth={1.6} />
              {n.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function SiteFooter() {
  const { user, isAuthenticated, authLoading } = useApp();
  const [footer, setFooter] = useState<FooterSettings>(emptyFooter);
  useEffect(() => {
    let current = true;
    apiRequest<{ data: FooterSettings }>("/content/footer", { auth: false })
      .then((result) => { if (current) setFooter(result.data || emptyFooter); })
      .catch(() => { /* Footer data is optional. */ });
    return () => { current = false; };
  }, []);
  return (
    <footer className="mt-6 border-t border-line bg-card">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 md:grid-cols-4 md:px-6">
        <div>
          <Link to="/" aria-label={BRAND.fullName}>
            <BrandLogo />
          </Link>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            From your NEET rank to the right seat. Aggregated counselling data for MBBS, BDS and
            AYUSH admissions, plus nursing, pharmacy and allied-health course information across
            India.
          </p>
          <Pill tone="teal" className="mt-3" dot>
            Medical admissions guidance
          </Pill>
        </div>
        <FooterCol
          title="Discover"
          links={[
            { to: "/colleges", label: "All colleges" },
            { to: "/cutoffs", label: "Cutoff explorer" },
            { to: "/courses", label: "All healthcare courses" },
            { to: "/compare", label: "Compare colleges" },
          ]}
        />
        <FooterCol
          title="Guidance"
          links={[
            { to: "/ai-match", label: "AI seat match" },
            { to: "/counselling/book", label: "1-to-1 counselling" },
            { to: "/upgrade", label: "Season Pass ₹99" },
            { to: "/dashboard", label: "Student dashboard" },
          ]}
        />
        <FooterCol
          title="Account"
          links={[
            ...(!isAuthenticated && !authLoading
              ? [
                  { to: "/login", label: "Log in" },
                  { to: "/signup", label: "Create account" },
                ]
              : [{ to: "/dashboard", label: "My account" }]),
            { to: "/notifications", label: "Notifications" },
            ...(user?.role === "admin" ? [{ to: "/admin", label: "Admin" }] : []),
          ]}
        />
        {footer.contacts.length > 0 && (
          <div>
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-muted-2">Contact</h4>
            <ul className="mt-3 grid gap-3">
              {footer.contacts.map((contact, index) => {
                const Icon = contactIcons[contact.type];
                return (
                  <li key={`${contact.type}-${contact.value}-${index}`}>
                    <a href={contactHref(contact)} className="flex items-start gap-2 text-[13.5px] text-muted transition-colors hover:text-teal-700">
                      <Icon className="mt-0.5 size-4 shrink-0" />
                      <span><span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-2">{contact.label}</span>{contact.value}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {footer.links.length > 0 && (
          <div>
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-muted-2">Connect</h4>
            <ul className="mt-3 flex flex-wrap gap-2">
              {footer.links.map((link, index) => {
                const Icon = socialIcons[link.icon];
                return <li key={`${link.url}-${index}`}><a href={link.url} target="_blank" rel="noreferrer" aria-label={link.label} title={link.label} className="flex size-9 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-teal-200 hover:bg-teal-050 hover:text-teal-700"><Icon className="size-4" /></a></li>;
              })}
            </ul>
          </div>
        )}
      </div>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-line-2 px-4 py-5 md:px-6">
        <a href={BRAND.companyUrl} aria-label="Visit Vidyarthi Mitra">
          <img
            src="/brand/vidyarthi-mitra.png"
            alt="Vidyarthi Mitra"
            width="222"
            height="56"
            className="h-10 w-auto"
            loading="lazy"
          />
        </a>
        <a href={BRAND.siteUrl} className="break-all text-xs text-muted">
          medical.vidyarthimitra.org
        </a>
        <p className="text-xs text-muted">
          &copy; {new Date().getFullYear()} {BRAND.company}. All rights reserved.
        </p>
      </div>
      <div className="border-t border-line-2 px-4 py-5 text-center text-[12px] text-muted-2 md:px-6">
        MedPath by Vidyarthi Mitra aggregates publicly available counselling data for guidance only.
        Always verify with the official counselling authority before locking choices.
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string; params?: Record<string, string> }[];
}) {
  return (
    <div>
      <h4 className="text-[12px] font-bold uppercase tracking-wider text-muted-2">{title}</h4>
      <ul className="mt-3 grid gap-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              to={l.to}
              params={l.params as never}
              className="text-[13.5px] text-muted transition-colors hover:text-teal-700"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
