import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, BookCheck, BookmarkCheck, CalendarClock, Check, CircleAlert, CircleCheck, IndianRupee } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { formatDashboardDateTime } from "@/lib/format";
import { markAllNotificationsRead, listNotifications, markNotificationRead } from "@/services/notifications";
import type { AppNotification } from "@/types/notification";

function NotificationIcon({ type }: { type: AppNotification["notification_type"] }) {
  const className = "size-5";
  if (type === "BOOK_ISSUED") return <BookCheck className={className} aria-hidden="true" />;
  if (type === "BOOK_RETURNED") return <CircleCheck className={className} aria-hidden="true" />;
  if (type === "RESERVATION_READY") return <BookmarkCheck className={className} aria-hidden="true" />;
  if (type === "DUE_SOON") return <CalendarClock className={className} aria-hidden="true" />;
  if (type === "LOAN_OVERDUE") return <CircleAlert className={className} aria-hidden="true" />;
  if (type === "FINE_PAID") return <CircleCheck className={className} aria-hidden="true" />;
  return <IndianRupee className={className} aria-hidden="true" />;
}

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["notifications", "center"],
    queryFn: listNotifications,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };
  const markRead = useMutation({ mutationFn: markNotificationRead, onSuccess: refresh });
  const markAllRead = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh });

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Your account</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Notifications</h1>
          <p className="text-sm text-muted-foreground">Updates about your loans, reservations, and fines.</p>
        </div>
        {data?.unread_count ? (
          <Button
            variant="outline"
            size="sm"
            disabled={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <Check aria-hidden="true" />
            Mark all as read
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <div role="status" className="rounded-2xl border border-border/70 bg-card/80 p-6 text-sm text-muted-foreground">
          Loading notifications…
        </div>
      ) : isError ? (
        <QueryErrorState message="Unable to load notifications." onRetry={() => void refetch()} />
      ) : data?.items.length ? (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <ul aria-label="Recent notifications" className="divide-y divide-border/70">
            {data.items.map((item) => {
              const content = (
                <>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                    <NotificationIcon type={item.notification_type} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{item.title}</span>
                      {!item.read_at ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">New</span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{item.message}</span>
                    <time className="mt-2 block text-xs text-muted-foreground/80" dateTime={item.created_at}>
                      {formatDashboardDateTime(item.created_at)}
                    </time>
                  </span>
                </>
              );
              return (
                <li key={item.id} className={`flex items-start gap-3 px-4 py-4 sm:px-5 ${!item.read_at ? "bg-primary/[0.035]" : ""}`}>
                  {item.link ? (
                    <Link
                      to={item.link}
                      onClick={() => {
                        if (!item.read_at) markRead.mutate(item.id);
                      }}
                      className="flex min-w-0 flex-1 items-start gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-start gap-3">{content}</div>
                  )}
                  {!item.read_at ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Mark ${item.title} as read`}
                      disabled={markRead.isPending}
                      onClick={() => markRead.mutate(item.id)}
                      className="shrink-0"
                    >
                      <Check aria-hidden="true" />
                      <span className="hidden sm:inline">Read</span>
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <EmptyState
          icon={data?.unread_count ? BellRing : Bell}
          message="You’re all caught up. New loan and circulation updates will appear here."
          actionLabel="Browse catalog"
          actionTo="/catalog/books"
        />
      )}
    </section>
  );
}
