import { BrandLogo } from "@/components/brand-logo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  Building2,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Btn, BtnLink, Panel, Pill, Skeleton, TextInput } from "@/components/kit";
import { apiRequest } from "@/lib/api-client";
import { toast } from "sonner";
import { AdminImportPanel } from "@/components/admin-import-center";
import { AdminTeamSettings } from "@/components/admin-team-settings";
import { AdminAccessSettings } from "@/components/admin-access-settings";
import { AdminNotificationPublisher } from "@/components/admin-notification-publisher";
import { AdminFooterSettings } from "@/components/admin-footer-settings";
import { AdminResourcePanel } from "@/components/admin-resource-panel";
import { useApp } from "@/lib/app-state";
import {
  adminGet,
  allowed,
  resources,
  attentionFilters,
  type AdminSession,
  type AttentionFilter,
  type MissingDataEntry,
} from "@/lib/admin";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin console | MedPath by Vidyarthi Mitra" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { user, authLoading, logout } = useApp();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [attention, setAttention] = useState<AttentionFilter | undefined>();
  const [missingEntry, setMissingEntry] = useState<MissingDataEntry | undefined>();
  const [feesRevision, setFeesRevision] = useState(0);
  const [usersRevision, setUsersRevision] = useState(0);
  const [showHostelRecords, setShowHostelRecords] = useState(false);

  const [draftId, setDraftId] = useState<string | undefined>();
  const [entryDirty, setEntryDirty] = useState(false);
  const [entryBusy, setEntryBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setSession(null);
    setError("");
    if (user?.role === "admin")
      adminGet<AdminSession>("/admin/session")
        .then((data) => {
          if (!current) return;
          setSession(data);
          if (!allowed(data, "analytics:read")) {
            const first = resources.find((r) => allowed(data, r.permission))?.key;
            setTab(first === "hostel-fees" ? "fees" : first || "import");
          }
        })
        .catch((err) => {
          if (current) setError(err.message);
        });
    return () => {
      current = false;
    };
  }, [user?.id, user?.role, retry]);
  if (authLoading)
    return (
      <div className="mx-auto w-full max-w-xl p-10">
        <Skeleton className="h-40" />
      </div>
    );
  if (user?.role !== "admin")
    return (
      <div className="mx-auto max-w-lg px-5 py-24 text-center">
        <ShieldCheck className="mx-auto size-10 text-teal-700" />
        <h1 className="mt-4 text-2xl">Admin access required</h1>
        <p className="my-4 text-sm text-muted">
          Log in with an account that has an assigned admin role.
        </p>
        <BtnLink to={user ? "/" : "/login"}>{user ? "Back to website" : "Log in"}</BtnLink>
      </div>
    );
  if (!session)
    return (
      <div className="mx-auto max-w-xl p-10">
        {error ? (
          <>
            <p role="alert" className="mb-4 text-rose">
              {error}
            </p>
            <Btn onClick={() => setRetry((n) => n + 1)}>Retry</Btn>
            <Link to="/" className="ml-4 text-sm">
              Back to website
            </Link>
          </>
        ) : (
          <Skeleton className="h-40" />
        )}
      </div>
    );
  const order = [
    "colleges",
    "courses",
    "college-courses",
    "cutoffs",
    "fees",
    "hostel-fees",
    "bonds",
    "seat-matrix",
    "users",
    "payments",
    "plans",
    "coupons",
    "bookings",
    "counsellors",
    "services",
    "slots",
    "audit-log",
  ];
  const visible = resources
    .filter((r) => allowed(session, r.permission))
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  const canImport = allowed(session, "imports:write");
  const resource = visible.find((r) => r.key === tab);
  const nav = [
    ...(allowed(session, "analytics:read") ? [{ key: "overview", label: "Overview" }] : []),
    ...(canImport
      ? [
          { key: "import", label: "Data entry" },
          { key: "entry-history", label: "Entry history" },
        ]
      : []),
    ...(canImport && allowed(session, "imports:review")
      ? [{ key: "entry-review", label: "Review & publish" }]
      : []),
    ...(allowed(session, "analytics:read") ? [{ key: "notifications", label: "Notifications" }] : []),
    ...visible.filter((r) => r.key !== "hostel-fees").map((r) => ({ key: r.key, label: r.label })),
    ...(allowed(session, "analytics:read") ? [{ key: "settings", label: "Site settings" }] : []),
  ];
  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="border-r border-line bg-ink p-5 text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
          <BrandLogo light />
        </Link>
        <p className="mb-6 mt-1 text-xs text-teal-100/70">Administration</p>
        <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto lg:grid">
          {nav.map((item) => (
            <button
              key={item.key}
              disabled={entryBusy}
              onClick={() => {
                if (item.key === tab && !attention) return;
                if (entryDirty && !window.confirm("Discard unsaved entry changes?")) return;
                setDraftId(undefined);
                setAttention(undefined);
                setMissingEntry(undefined);
                setTab(item.key);
              }}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                tab === item.key
                  ? "bg-teal-600 font-semibold text-white"
                  : "text-white/65 hover:bg-white/10 hover:text-white",
              )}
            >
              {item.key === "overview" ? (
                <LayoutDashboard className="size-4" />
              ) : item.key === "import" ? (
                <Upload className="size-4" />
              ) : null}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-6 hidden border-t border-white/10 pt-5 lg:block">
          <p className="truncate text-sm">{user.name || user.email || user.phone}</p>
          <p className="mt-1 text-xs text-white/50">{session.role.replaceAll("_", " ")}</p>
          <button onClick={logout} className="mt-4 flex items-center gap-2 text-xs text-white/70">
            <LogOut className="size-4" /> Log out
          </button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-card px-5 py-4 md:px-8">
          <div>
            <p className="text-xs text-muted">
              Workspace / {nav.find((n) => n.key === tab)?.label || "Admin"}
            </p>
            <h1 className="mt-1 text-xl">
              {tab === "overview"
                ? "Your platform at a glance"
                : nav.find((n) => n.key === tab)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Pill tone="teal" dot>
              Live data
            </Pill>
            <Link to="/" className="flex items-center gap-1 text-sm font-semibold text-teal-700">
              View website <ArrowUpRight className="size-4" />
            </Link>
            <button onClick={logout} className="text-xs text-muted lg:hidden">
              Log out
            </button>
          </div>
        </header>
        <div className="p-4 md:p-8">
          {tab === "overview" && allowed(session, "analytics:read") && (
            <Overview
              session={session}
              onAttention={(filter) => {
                setAttention(filter);
                setMissingEntry(undefined);
                setTab(attentionFilters[filter].resource);
              }}
            />
          )}
          {tab === "users" && session.role === "super_admin" && (
            <AdminAccessSettings onChanged={() => setUsersRevision((value) => value + 1)} />
          )}
          {tab === "notifications" && allowed(session, "analytics:read") && <AdminNotificationPublisher />}
          {resource && (
            <AdminResourcePanel
              key={
                resource.key === "fees"
                  ? `fees-${feesRevision}`
                  : resource.key === "users"
                    ? `users-${usersRevision}`
                    : `${resource.key}-${attention || "all"}`
              }
              resource={resource}
              session={session}
              attention={attention}
              onClearAttention={() => setAttention(undefined)}
              onMissingEntry={(entry) => {
                setMissingEntry(entry);
                setDraftId(undefined);
                setAttention(undefined);
                setTab("import");
              }}
              onDraft={(id) => {
                setMissingEntry(undefined);
                setAttention(undefined);
                setDraftId(id);
                setTab("import");
              }}
            />
          )}
          {tab === "fees" && visible.find((r) => r.key === "hostel-fees") && (
            <details className="mt-5" onToggle={(e) => setShowHostelRecords(e.currentTarget.open)}>
              <summary className="cursor-pointer text-sm text-muted">
                Manage saved college-wide hostel amounts
              </summary>
              <p className="my-3 text-xs text-muted">
                New entries use the combined Fees form. These shared records include earlier
                hostel-only uploads. Deleting one removes the hostel amount for every course of that
                college/year.
              </p>
              {showHostelRecords && (
                <AdminResourcePanel
                  resource={visible.find((r) => r.key === "hostel-fees")!}
                  session={session}
                  onChanged={() => setFeesRevision((value) => value + 1)}
                  onDraft={(id) => {
                    setMissingEntry(undefined);
                    setDraftId(id);
                    setTab("import");
                  }}
                />
              )}
            </details>
          )}
          {["import", "entry-history", "entry-review"].includes(tab) &&
            canImport &&
            (tab !== "entry-review" || allowed(session, "imports:review")) && (
              <AdminImportPanel
                key={`${tab}-${draftId || missingEntry?.entity || "new"}`}
                session={session}
                workspace={
                  tab === "entry-review" ? "review" : tab === "entry-history" ? "history" : "entry"
                }
                onDirtyChange={setEntryDirty}
                onBusyChange={setEntryBusy}
                {...(draftId ? { initialBatchId: draftId } : {})}
                {...(missingEntry && !draftId ? { initialEntry: missingEntry } : {})}
              />
            )}
          {tab === "settings" && allowed(session, "analytics:read") && (
            <>
              <ServiceStatus />
              {session.role === "super_admin" && <AdminAccessSettings />}
              {allowed(session, "roles:manage") && <AdminTeamSettings />}
              {allowed(session, "colleges:write") && <DeadlineEditor />}
              <AdminFooterSettings />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface Dashboard {
  generatedAt: string;
  totals: { revenue: number; students: number; bookings: number; activeSubscriptions: number };
  catalog: {
    colleges: number;
    activeColleges: number;
    missingImages: number;
    links: number;
    fees: number;
    cutoffs: number;
    seats: number;
    courses: number;
    missingFees: number;
    missingCutoffs: number;
  };
  series: { date: string; revenue: number; students: number; bookings: number }[];
  states: { _id: string; count: number }[];
  paymentStatus: { _id: string; count: number }[];
}
function Overview({
  session,
  onAttention,
}: {
  session: AdminSession;
  onAttention: (filter: AttentionFilter) => void;
}) {
  const [days, setDays] = useState("30");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setData(null);
    setError("");
    adminGet<Dashboard>(`/admin/analytics/dashboard?days=${days}`)
      .then((res) => {
        if (current) setData(res);
      })
      .catch((err) => {
        if (current) setError(err.message);
      });
    return () => {
      current = false;
    };
  }, [days, revision]);
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Activity over the selected period. Catalog counts show the current inventory.
        </p>
        <div className="flex gap-2">
          <select
            aria-label="Analytics period"
            className="rounded-xl border border-line bg-card px-3 py-2 text-sm"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          >
            {["7", "30", "90"].map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
          <Btn
            variant="ghost"
            size="sm"
            aria-label="Refresh analytics"
            onClick={() => setRevision((r) => r + 1)}
          >
            <RefreshCw className="size-4" />
          </Btn>
        </div>
      </div>
      {error ? (
        <Panel className="p-5 text-rose" role="alert">
          {error}
        </Panel>
      ) : !data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Paid revenue",
                value: `₹${data.totals.revenue.toLocaleString("en-IN")}`,
                hint: `Last ${days} days`,
              },
              { label: "New students", value: data.totals.students, hint: `Last ${days} days` },
              { label: "Bookings created", value: data.totals.bookings, hint: `Last ${days} days` },
              {
                label: "Active subscriptions",
                value: data.totals.activeSubscriptions,
                hint: "Current, unexpired",
              },
            ].map((kpi) => (
              <Panel key={kpi.label} className="p-5">
                <p className="text-xs font-semibold text-muted">{kpi.label}</p>
                <p className="num mt-3 text-3xl font-semibold tracking-tight">{kpi.value}</p>
                <p className="mt-2 text-xs text-muted-2">{kpi.hint}</p>
              </Panel>
            ))}
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Panel className="min-w-0 p-5">
              <h2 className="text-lg">Revenue trend</h2>
              <p className="mb-5 text-xs text-muted">
                Paid payments by last update date · INR · India time
              </p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.series}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => v.slice(5)}
                      minTickGap={40}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tick={{ fontSize: 11 }} width={55} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#0a6e68"
                      fill="#d6eeea"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel className="min-w-0 p-5">
              <h2 className="text-lg">Student activity</h2>
              <p className="mb-5 text-xs text-muted">New registrations and bookings per day</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.series}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => v.slice(5)}
                      minTickGap={40}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={35} />
                    <Tooltip />
                    <Bar name="Students" dataKey="students" fill="#0a6e68" radius={[3, 3, 0, 0]} />
                    <Bar name="Bookings" dataKey="bookings" fill="#bf903d" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            <Panel className="p-5">
              <h2 className="text-lg">Catalog coverage</h2>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {[
                  ["Published colleges", data.catalog.activeColleges],
                  ["All colleges", data.catalog.colleges],
                  ["Courses", data.catalog.courses],
                  ["Course links", data.catalog.links],
                  ["Cutoff rows", data.catalog.cutoffs],
                  ["Fee records", data.catalog.fees],
                  ["Seat records", data.catalog.seats],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted">{label}</p>
                    <p className="num text-xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel className="p-5">
              <h2 className="text-lg">Data needs attention</h2>
              <p className="mt-1 text-xs text-muted">
                Complete these before directing students to your catalog.
              </p>
              <div className="mt-4 grid gap-3">
                {[
                  { filter: "photos" as const, count: data.catalog.missingImages },
                  { filter: "fees" as const, count: data.catalog.missingFees },
                  { filter: "cutoffs" as const, count: data.catalog.missingCutoffs },
                ].map(({ filter, count }) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => onAttention(filter)}
                    disabled={!allowed(session, attentionFilters[filter].permission)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl bg-paper p-3 text-left text-sm transition-colors hover:bg-teal-050 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span>{attentionFilters[filter].label}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <Pill tone={count ? "gold" : "emerald"}>{count}</Pill>
                      <ArrowUpRight className="size-4 text-muted" aria-hidden="true" />
                    </span>
                  </button>
                ))}
              </div>
            </Panel>
            <Panel className="p-5">
              <h2 className="text-lg">Payments by status</h2>
              <p className="mt-1 text-xs text-muted">Orders created in the selected period</p>
              <div className="mt-4 grid gap-3">
                {data.paymentStatus.length ? (
                  data.paymentStatus.map((item) => (
                    <div key={item._id} className="flex justify-between text-sm">
                      <span className="capitalize">{item._id}</span>
                      <strong className="num">{item.count}</strong>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted">No payments in this period.</p>
                )}
              </div>
            </Panel>
          </div>
          <Panel className="p-5">
            <h2 className="text-lg">Published colleges by state</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.states.length ? (
                data.states.map((state) => (
                  <div
                    key={state._id}
                    className="flex justify-between gap-3 rounded-xl bg-paper p-3 text-sm"
                  >
                    <span>{state._id}</span>
                    <strong className="num">{state.count}</strong>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">Publish colleges to see coverage here.</p>
              )}
            </div>
          </Panel>
          <p className="text-xs text-muted">
            Updated {new Date(data.generatedAt).toLocaleString("en-IN")}. Revenue is based on
            payment records, not a settlement report.
          </p>
        </>
      )}
    </div>
  );
}

function ServiceStatus() {
  const [setup, setSetup] = useState<Record<string, boolean | string> | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setError("");
    adminGet<Record<string, boolean | string>>("/admin/setup")
      .then((data) => {
        if (current) setSetup(data);
      })
      .catch((err) => {
        if (current) setError(err.message);
      });
    return () => {
      current = false;
    };
  }, [revision]);
  return (
    <div className="grid gap-5">
      <Panel className="p-6">
        <div className="flex justify-between">
          <h2 className="text-xl">Service configuration</h2>
          <Btn size="sm" variant="ghost" onClick={() => setRevision((r) => r + 1)}>
            Refresh
          </Btn>
        </div>
        <p className="mt-2 text-sm text-muted">
          Checks configuration presence. Verify delivery and payments in your deployed environment.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-rose">
            {error}
          </p>
        )}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {setup &&
            ["cloudinary", "email", "sms", "payments"].map((key) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-xl border border-line p-4"
              >
                <span className="capitalize">{key}</span>
                <Pill tone={setup[key] ? "emerald" : "gold"}>
                  {setup[key] ? "Configured" : "Setup needed"}
                </Pill>
              </div>
            ))}
        </div>
      </Panel>
    </div>
  );
}

function DeadlineEditor() {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    adminGet<{ title: string; date: string; sourceUrl: string; enabled: boolean } | null>(
      "/admin/deadline",
    )
      .then((data) => {
        if (!current || !data) return;
        setTitle(data.title);
        setSourceUrl(data.sourceUrl);
        setEnabled(data.enabled);
        const d = new Date(data.date);
        setDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      })
      .catch((err) => {
        if (current) setError(err.message);
      })
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, []);
  return (
    <Panel className="mt-5 p-6">
      <h2 className="text-xl">Student dashboard deadline</h2>
      <p className="mt-2 text-sm text-muted">
        Publish a verified deadline with its official source. Expired or disabled deadlines are
        hidden automatically.
      </p>
      <form
        className="mt-4 grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await apiRequest("/admin/deadline", {
              method: "PUT",
              body: { title, date: new Date(date).toISOString(), sourceUrl, enabled },
            });
            toast.success("Deadline saved");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save deadline");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="text-sm">
          Title
          <TextInput
            required
            placeholder="e.g. MCC Round 1 choice filling closes"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Deadline (your local timezone)
          <TextInput
            required
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Official source URL
          <TextInput
            required
            type="url"
            placeholder="https://…"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />{" "}
          Show on student dashboard
        </label>
        <Btn disabled={busy}>Save deadline</Btn>
        {error && (
          <p role="alert" className="text-sm text-rose">
            {error}
          </p>
        )}
      </form>
    </Panel>
  );
}
