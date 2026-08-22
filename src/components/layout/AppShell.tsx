"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { employeeNav, hrNav } from "@/lib/ui/nav";
import { Avatar } from "@/components/ui/Avatar";
import { NotificationsMenu } from "@/components/notifications/NotificationsMenu";
import { api } from "@/lib/client/api";

export interface ShellUser {
  fullName: string;
  role: "EMPLOYEE" | "HR";
  employeeCode: string;
  profilePhotoUrl?: string | null;
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const nav = user.role === "HR" ? hrNav : employeeNav;

  async function handleSignOut() {
    await api.post("/api/auth/signout");
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[var(--df-bg)]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[var(--df-border)] bg-[var(--df-bg-elevated)] lg:flex">
        <SidebarContent nav={nav} pathname={pathname} user={user} onSignOut={handleSignOut} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="relative flex h-full w-72 flex-col border-r border-[var(--df-border)] bg-[var(--df-bg-elevated)] df-animate-in">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 rounded-full p-1.5 text-[var(--df-text-muted)] hover:bg-white/5"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            <SidebarContent nav={nav} pathname={pathname} user={user} onSignOut={handleSignOut} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex flex-col lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-[var(--df-border)] bg-[var(--df-bg)]/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-2 text-[var(--df-text-secondary)] hover:bg-white/5 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            <p className="text-sm font-medium text-[var(--df-text-secondary)]">
              {user.role === "HR" ? "HR Command Center" : "Every workday, perfectly aligned."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationsMenu />
            <Link href="/profile" className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 hover:bg-white/5">
              <Avatar name={user.fullName} src={user.profilePhotoUrl} size={30} />
              <span className="hidden text-sm text-[var(--df-text-primary)] sm:inline">{user.fullName.split(" ")[0]}</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  nav,
  pathname,
  user,
  onSignOut,
  onNavigate,
}: {
  nav: typeof employeeNav;
  pathname: string;
  user: ShellUser;
  onSignOut: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2.5 px-5 py-6">
        <div className="flex size-9 items-center justify-center rounded-[var(--df-radius-md)] bg-[var(--df-accent-soft)] text-[var(--df-accent)] font-bold">
          D
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--df-text-primary)] leading-tight">Dayflow</p>
          <p className="text-[10px] uppercase tracking-wider text-[var(--df-text-muted)]">HRMS</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && item.href !== "/hr" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-[var(--df-radius-md)] px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-[var(--df-accent-soft)] text-[var(--df-accent)]" : "text-[var(--df-text-secondary)] hover:bg-white/5 hover:text-[var(--df-text-primary)]"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className="size-4.5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--df-border)] p-3">
        <div className="flex items-center gap-2.5 rounded-[var(--df-radius-md)] px-2 py-2">
          <Avatar name={user.fullName} src={user.profilePhotoUrl} size={34} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--df-text-primary)]">{user.fullName}</p>
            <p className="truncate text-xs text-[var(--df-text-muted)]">{user.employeeCode}</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="mt-1 flex w-full items-center gap-3 rounded-[var(--df-radius-md)] px-3 py-2.5 text-sm font-medium text-[var(--df-text-secondary)] hover:bg-white/5 hover:text-[var(--df-danger)]"
        >
          <LogOut className="size-4.5" aria-hidden />
          Sign out
        </button>
      </div>
    </>
  );
}
