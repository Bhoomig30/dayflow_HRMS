"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { timeAgo } from "@/lib/ui/format";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ notifications: NotificationItem[]; unreadCount: number }>("/api/notifications");
      setItems(res.notifications);
      setUnread(res.unreadCount);
    } catch {
      // Leave items null -> error state shown in panel
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markAllRead() {
    await api.post("/api/notifications/read-all");
    setItems((prev) => prev?.map((n) => ({ ...n, isRead: true })) ?? null);
    setUnread(0);
  }

  async function markOneRead(id: string) {
    await api.post(`/api/notifications/${id}/read`);
    setItems((prev) => prev?.map((n) => (n.id === id ? { ...n, isRead: true } : n)) ?? null);
    setUnread((u) => Math.max(0, u - 1));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className="relative rounded-full p-2 text-[var(--df-text-secondary)] hover:bg-white/5 hover:text-[var(--df-text-primary)]"
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[var(--df-danger)] text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="df-animate-in absolute right-0 top-12 z-30 w-80 max-w-[90vw] rounded-[var(--df-radius-lg)] border border-[var(--df-border-strong)] bg-[var(--df-bg-elevated)] shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--df-border)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--df-text-primary)]">Notifications</p>
            {items && items.length > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-[var(--df-accent)] hover:underline">
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && !items && <div className="px-4 py-8 text-center text-xs text-[var(--df-text-muted)]">Loading…</div>}
            {!loading && items && items.length === 0 && <EmptyState title="You're all caught up." className="py-8" />}
            {items?.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.isRead && markOneRead(n.id)}
                className={cn(
                  "block w-full border-b border-[var(--df-border)] px-4 py-3 text-left last:border-b-0 hover:bg-white/[0.03]",
                  !n.isRead && "bg-[var(--df-accent-soft)]/40"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-[var(--df-text-primary)]">{n.title}</p>
                  {!n.isRead && <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--df-accent)]" />}
                </div>
                <p className="mt-0.5 text-xs text-[var(--df-text-muted)]">{n.message}</p>
                <p className="mt-1 text-[10px] text-[var(--df-text-muted)]">{timeAgo(n.createdAt)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
