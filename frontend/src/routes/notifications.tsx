import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, CalendarClock, Database, CheckCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Btn, EmptyState, Num, Panel, Pill, Skeleton } from "@/components/kit";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications & counselling alerts — MedPath by Vidyarthi Mitra" },
      {
        name: "description",
        content:
          "Round deadlines, cutoff data updates, booking confirmations and premium seat-matrix alerts in one feed.",
      },
      { property: "og:title", content: "Notifications — MedPath by Vidyarthi Mitra" },
      { property: "og:description", content: "Never miss a counselling round deadline." },
    ],
  }),
  component: Notifications,
});

const icons: Record<string, typeof Bell> = {
  deadline: CalendarClock,
  data: Database,
  booking: CheckCheck,
  alert: Sparkles,
};

interface NotificationItem {
  body: string;
  id: string;
  title: string;
  time: string;
  unread: boolean;
  premium: boolean;
  kind: string;
}

function Notifications() {
  const { isAuthenticated } = useApp();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    fetchNotifications(page)
      .then((result) => {
        if (current) {
          setItems(result.items);
          setPages(result.totalPages);
        }
      })
      .catch(() => {
        if (current) setError(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [isAuthenticated, page, attempt]);

  const unread = items.filter((i) => i.unread).length;

  if (!isAuthenticated) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 md:px-6">
        <EmptyState
          title="Log in to see your notifications"
          sub="Deadline reminders and booking updates show up here once you're signed in."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6 md:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] md:text-[34px]">Notifications</h1>
          <p className="mt-1.5 text-sm text-muted">
            <Num>{unread}</Num> unread · deadlines are shown in IST
          </p>
        </div>
        <Btn
          variant="ghost"
          size="sm"
          onClick={async () => {
            try {
              await markAllNotificationsRead();
              setItems((cur) => cur.map((i) => ({ ...i, unread: false })));
              toast.success("All notifications marked read");
            } catch {
              toast.error("Could not sync with server");
            }
          }}
        >
          Mark all read
        </Btn>
      </div>

      {loading ? (
        <div className="mt-6 grid gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : error ? (
        <div role="alert" className="mt-6">
          Could not load notifications.{" "}
          <Btn variant="link" onClick={() => setAttempt((value) => value + 1)}>
            Retry notifications
          </Btn>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No notifications yet"
            sub="Deadlines, booking confirmations and premium alerts will show up here."
          />
        </div>
      ) : (
        <Panel className="mt-6 divide-y divide-line-2 overflow-hidden">
          {items.map((n) => {
            const Icon = icons[n.kind] ?? Bell;
            return (
              <button
                key={n.id}
                onClick={async () => {
                  try {
                    await markNotificationRead(n.id);
                    setItems((cur) =>
                      cur.map((i) => (i.id === n.id ? { ...i, unread: false } : i)),
                    );
                  } catch {
                    toast.error("Could not mark this notification read");
                  }
                }}
                className={cn(
                  "flex w-full items-start gap-3.5 p-4 text-left transition-colors duration-[180ms] hover:bg-paper",
                  n.unread && "bg-teal-050/50",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-[12px]",
                    n.premium ? "bg-gold-050 text-gold-600" : "bg-teal-050 text-teal-700",
                  )}
                >
                  <Icon className="size-[18px]" strokeWidth={1.6} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[14.5px] font-semibold leading-snug">{n.title}</span>
                    {n.premium && <Pill tone="gold">Premium alert</Pill>}
                  </span>
                  <Num className="mt-1 block text-[11.5px] text-muted-2">{n.time}</Num>
                  <span className="mt-1 block text-sm text-muted">{n.body}</span>
                </span>
                {n.unread && <span className="mt-2 size-2 shrink-0 rounded-full bg-rose" />}
              </button>
            );
          })}
        </Panel>
      )}
      {pages > 1 && (
        <nav
          aria-label="Notification pages"
          className="mt-5 flex items-center justify-center gap-4"
        >
          <Btn
            variant="ghost"
            disabled={loading || page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </Btn>
          <span>
            {page} / {pages}
          </span>
          <Btn
            variant="ghost"
            disabled={loading || page >= pages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Btn>
        </nav>
      )}
    </div>
  );
}
