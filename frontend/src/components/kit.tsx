import { Link } from "@tanstack/react-router";
import { Lock, Search, ChevronDown, Heart, GitCompare, Inbox } from "lucide-react";
import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import type { Band, College } from "@/lib/catalog";
import { inr, rank as fmtRank } from "@/lib/catalog";

/* ---------------- Button ---------------- */

type Variant = "primary" | "ghost" | "gold" | "dark" | "violet" | "link";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-teal-600 text-white hover:bg-teal-700 shadow-sh-1",
  ghost: "bg-card text-ink border border-line hover:bg-teal-050 hover:border-teal-100",
  gold: "bg-gold-600 text-white hover:bg-gold-500 shadow-gold",
  dark: "bg-ink text-white hover:bg-ink-2",
  violet: "bg-violet-600 text-white hover:bg-violet-500 shadow-sh-1",
  link: "text-teal-700 hover:text-teal-600 underline-offset-4 hover:underline px-0",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px] rounded-[8px]",
  md: "h-11 px-4 text-sm rounded-[12px]",
  lg: "h-13 px-6 text-[15px] rounded-[14px]",
};

export function Btn({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: {
  variant?: Variant;
  size?: Size;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 font-semibold transition-all duration-[180ms] ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function BtnLink({
  to,
  variant = "primary",
  size = "md",
  className,
  children,
  params,
  search,
}: {
  to: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  params?: Record<string, string>;
  search?: Record<string, string>;
}) {
  return (
    <Link
      to={to}
      params={params as never}
      search={search as never}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 font-semibold transition-all duration-[180ms] ease-out",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* ---------------- Pill ---------------- */

type Tone = "teal" | "gold" | "violet" | "emerald" | "rose" | "sky" | "gray";

const tones: Record<Tone, { wrap: string; dot: string }> = {
  teal: { wrap: "bg-teal-050 text-teal-700 border-teal-100", dot: "bg-teal-600" },
  gold: { wrap: "bg-gold-050 text-gold-600 border-gold-100", dot: "bg-gold-600" },
  violet: { wrap: "bg-violet-050 text-violet-600 border-violet-100", dot: "bg-violet-600" },
  emerald: { wrap: "bg-emerald-050 text-emerald border-emerald/20", dot: "bg-emerald" },
  rose: { wrap: "bg-rose-050 text-rose border-rose/20", dot: "bg-rose" },
  sky: { wrap: "bg-sky-050 text-sky border-sky/20", dot: "bg-sky" },
  gray: { wrap: "bg-board text-muted border-line", dot: "bg-muted-2" },
};

export function Pill({
  tone = "gray",
  dot = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        tones[tone].wrap,
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", tones[tone].dot)} />}
      {children}
    </span>
  );
}

/* ---------------- Layout primitives ---------------- */

export function Panel({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn("rounded-[16px] border border-line bg-card shadow-sh-1", className)}
    >
      {children}
    </div>
  );
}

export function Section({
  title,
  sub,
  action,
  children,
  className,
}: {
  title?: string;
  sub?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-14", className)}>
      {(title || action) && (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            {title && <h2 className="text-[22px] md:text-[28px]">{title}</h2>}
            {sub && <p className="mt-1 max-w-2xl text-sm text-muted">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Num({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("num", className)}>{children}</span>;
}

/* ---------------- Inputs ---------------- */

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cn(
        "h-11 w-full rounded-[12px] border border-line bg-card px-3.5 text-sm text-ink placeholder:text-muted-2",
        "transition-colors duration-[180ms] focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25",
        className,
      )}
    />
  );
}

export function SearchBar({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative w-full", className)}>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-2"
        strokeWidth={1.6}
      />
      <input
        {...rest}
        className="h-11 w-full rounded-[12px] border border-line bg-card pl-10 pr-3.5 text-sm placeholder:text-muted-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25"
      />
    </div>
  );
}

export function Dropdown({
  label,
  options,
  className,
  ...rest
}: { label?: string; options: (string | number)[] } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={cn("block min-w-0", className)}>
      {label && (
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-2">
          {label}
        </span>
      )}
      <span className="relative block">
        <select
          {...rest}
          className="h-11 w-full min-w-0 appearance-none rounded-[12px] border border-line bg-card pl-3.5 pr-9 text-sm text-ink focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-2"
          strokeWidth={1.6}
        />
      </span>
    </label>
  );
}

/* ---------------- Probability ---------------- */

export const bandMeta: Record<Band, { label: string; tone: Tone; bar: string; text: string }> = {
  safe: { label: "Safe", tone: "emerald", bar: "bg-emerald", text: "text-emerald" },
  target: { label: "Target", tone: "gold", bar: "bg-gold-600", text: "text-gold-600" },
  dream: { label: "Dream", tone: "violet", bar: "bg-violet-600", text: "text-violet-600" },
};

export function ProbabilityBar({ band, value }: { band: Band; value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-board">
      <div
        className={cn("h-full rounded-full transition-all duration-500", bandMeta[band].bar)}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

/* ---------------- Lock overlay ---------------- */

export function LockOverlay({
  title,
  desc,
  cta = "Unlock all cutoffs · ₹99",
  caption = "One-time · valid all counselling season",
  children,
}: {
  title: string;
  desc: string;
  cta?: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-[16px]">
      <div className="blurwrap" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-card/40 via-card/70 to-card/95 p-4">
        <div className="w-full max-w-sm rounded-[22px] border border-gold-100 bg-card p-5 text-center shadow-sh-3">
          <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-gold-050 text-gold-600">
            <Lock className="size-5" strokeWidth={1.6} />
          </span>
          <h3 className="text-[17px]">{title}</h3>
          <p className="mx-auto mt-1.5 max-w-xs text-[13px] leading-relaxed text-muted">{desc}</p>
          <BtnLink to="/upgrade" variant="gold" className="mt-4 w-full">
            {cta}
          </BtnLink>
          <p className="mt-2 text-[11px] text-muted-2">{caption}</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Skeleton / empty ---------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-[8px]", className)} />;
}

export function EmptyState({
  icon,
  title,
  sub,
  action,
}: {
  icon?: ReactNode;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-line bg-card px-6 py-14 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-teal-050 text-teal-700">
        {icon ?? <Inbox className="size-5" strokeWidth={1.6} />}
      </span>
      <h3 className="text-[17px]">{title}</h3>
      {sub && <p className="mt-1 max-w-sm text-[13px] text-muted">{sub}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------------- College card ---------------- */

export function CollegeCard({
  college,
  saved,
  onSave,
  onCompare,
  band,
}: {
  college: College;
  saved?: boolean;
  onSave?: () => void;
  onCompare?: () => void;
  band?: Band;
}) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-[16px] border border-line bg-card shadow-sh-1 transition-all duration-[180ms] hover:-translate-y-0.5 hover:shadow-sh-2">
      <div className="relative h-32 bg-gradient-to-br from-teal-100 to-teal-050">
        <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_20%,#0a6e68_1px,transparent_1px)] [background-size:14px_14px]" />
        {college.images?.[0] && (
          <img
            src={college.images[0]}
            alt={`${college.name} campus`}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <Pill
            tone={
              college.ownership === "Government"
                ? "teal"
                : college.ownership === "Deemed"
                  ? "sky"
                  : "gray"
            }
            dot
          >
            {college.ownership}
          </Pill>
          {band && (
            <Pill tone={bandMeta[band].tone} dot>
              {bandMeta[band].label}
            </Pill>
          )}
        </div>
        {onSave && (
          <button
            onClick={onSave}
            aria-label="Save college"
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-card/90 text-muted shadow-sh-1 transition-colors hover:text-rose"
          >
            <Heart className={cn("size-4", saved && "fill-rose text-rose")} strokeWidth={1.6} />
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <Link
          to="/colleges/$id"
          params={{ id: college.id }}
          className="text-[15px] font-semibold leading-snug text-ink hover:text-teal-700"
        >
          {college.name}
        </Link>
        <p className="mt-1 text-[12.5px] text-muted">
          {college.city}, {college.state}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {college.courses.map((c) => (
            <Pill key={c} tone="teal">
              {c}
            </Pill>
          ))}
        </div>
        <div className="mt-4 flex items-end justify-between border-t border-line-2 pt-3">
          <div>
            <p className="text-[10.5px] uppercase tracking-wider text-muted-2">Seats</p>
            <Num className="text-[15px] font-semibold">{college.seats ?? "N/A"}</Num>
          </div>
          <div className="text-right">
            <p className="text-[10.5px] uppercase tracking-wider text-muted-2">Latest cutoff</p>
            <Num className="text-[15px] font-semibold">
              {college.closingRank > 0 ? fmtRank(college.closingRank) : "Not published"}
            </Num>
          </div>
        </div>
        {college.closingRank > 0 && (
          <p className="mt-2 text-xs text-muted">
            {college.closingRankCourse} · {college.closingRankCategory} · {college.quota} ·{" "}
            {college.closingRankYear} · {college.closingRankRound}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <BtnLink
            to="/colleges/$id"
            params={{ id: college.id }}
            variant="ghost"
            size="sm"
            className="flex-1"
          >
            View
          </BtnLink>
          {onCompare && (
            <Btn
              variant="ghost"
              size="sm"
              onClick={onCompare}
              className="px-2.5"
              aria-label="Add to compare"
            >
              <GitCompare className="size-4" strokeWidth={1.6} />
            </Btn>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted-2">
          {college.feeFrom != null ? (
            <>
              From <Num>{inr(college.feeFrom)}</Num>/yr
            </>
          ) : (
            "Fees: N/A"
          )}
        </p>
      </div>
    </div>
  );
}
