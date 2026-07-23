"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FolderKanban, ListTodo, CheckSquare, BarChart3, Settings, Bell, Search, Plus, ChevronDown, LogOut } from "lucide-react";

type UserData = { id: string; name: string; email: string; role: string };
type NotificationItem = { id: string; type: string; message: string; read: boolean; createdAt: string };
type NavItem = { label: string; path: string; icon: React.ReactNode; countKey: string };

const navItems: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: <LayoutDashboard size={16} />, countKey: "" },
  { label: "Projects", path: "/projects", icon: <FolderKanban size={16} />, countKey: "projects" },
  { label: "My Work", path: "/mywork", icon: <ListTodo size={16} />, countKey: "myWork" },
  { label: "Approvals", path: "/approvals", icon: <CheckSquare size={16} />, countKey: "approvals" },
  { label: "Reports", path: "/reports", icon: <BarChart3 size={16} />, countKey: "" },
  { label: "Settings", path: "/settings", icon: <Settings size={16} />, countKey: "" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const userRes = await fetch("/api/auth");
        const u = userRes.ok ? await userRes.json() : null;
        if (u?.id) setUser(u);
        const [usersRes, notifRes] = await Promise.all([
          fetch("/api/users").catch(() => null),
          fetch("/api/notifications").catch(() => null),
        ]);
        if (usersRes?.ok) setUsers(await usersRes.json());
        if (notifRes?.ok) setNotifications(await notifRes.json());
        const projectsRes = await fetch("/api/projects").catch(() => null);
        if (projectsRes?.ok) {
          const data = await projectsRes.json();
          const c: Record<string, number> = {};
          if (Array.isArray(data)) c.projects = data.length;
          setCounts(c);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function switchUser(targetUser: UserData) {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", name: targetUser.name, password: "any" }),
    });
    router.refresh();
  }

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      setShowUserMenu(false);
      router.replace("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  const unreadCount = notifications.filter(n => !n.read).length;
  const isActive = (path: string) => pathname === path || pathname.startsWith(path + "/");

  if (loading) {
    return <div className="min-h-screen bg-[var(--canvas-soft)] flex items-center justify-center"><div className="font-mono text-xs text-[var(--mute)] uppercase tracking-wider">Loading...</div></div>;
  }

  return (
    <div className="h-screen overflow-hidden flex">
      <aside className="h-full overflow-hidden w-56 bg-[var(--canvas)] flex flex-col shrink-0 border-r border-[var(--hairline)]">
        <nav className="flex-1 px-2 pt-2 space-y-0.5">
          {navItems.map(item => {
            const active = isActive(item.path);
            const count = item.countKey ? counts[item.countKey] : undefined;
            return (
              <Link key={item.path} href={item.path} className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-sm transition-colors ${active ? "bg-[var(--canvas-soft-2)] text-[var(--ink)] font-medium" : "text-[var(--body)] hover:bg-[var(--canvas-soft)] hover:text-[var(--ink)]"}`}>
                <span className="shrink-0 opacity-60">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {count !== undefined && <span className="font-mono text-[11px] tabular-nums bg-[var(--canvas-soft-2)] px-1.5 py-0.5 rounded-[var(--radius-xs)] text-[var(--mute)]">{count}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="bg-[var(--canvas)] border-b border-[var(--hairline)] h-14 flex items-center gap-3 px-6 shrink-0">
          <div className="flex-1 max-w-sm">
            <div className="w-full relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--mute)]" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 border border-[var(--hairline)] rounded-[var(--radius-lg)] text-sm text-[var(--ink)] bg-[var(--canvas-soft)] outline-none focus:border-[var(--primary)] placeholder:text-[var(--mute)] transition-colors" />
            </div>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <button className="flex items-center gap-1.5 bg-[var(--primary)] text-white px-3 py-1.5 rounded-[var(--radius-sm)] text-sm font-medium hover:opacity-80 transition-opacity whitespace-nowrap"><Plus size={14} />New Project</button>
            <div className="w-px h-5 bg-[var(--hairline)] mx-1" />

            <div className="relative" ref={notifRef}>
              <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-1.5 rounded-[var(--radius-sm)] text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--canvas-soft)] transition-colors" aria-label="Notifications">
                <Bell size={18} />
                {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center bg-[var(--primary)] text-white text-[9px] font-mono font-medium rounded-full leading-none">{unreadCount > 9 ? "9+" : unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--canvas)] rounded-[var(--radius-lg)] shadow-[var(--shadow-hairline),var(--shadow-level-3)] overflow-hidden z-50 animate-fade-in">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--hairline)]">
                    <span className="font-medium text-sm text-[var(--ink)]">Notifications</span>
                    {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-[var(--link)] hover:underline">Mark all read</button>}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? <div className="px-4 py-8 text-center text-xs text-[var(--mute)]">No notifications</div> : notifications.map(n => (
                      <div key={n.id} className={`px-4 py-3 border-b border-[var(--hairline)] last:border-0 ${n.read ? "" : "bg-[var(--canvas-soft)]"}`}>
                        <div className="text-sm text-[var(--ink)]">{n.message}</div>
                        <div className="font-mono text-[10px] text-[var(--mute)] mt-0.5">{new Date(n.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={userMenuRef}>
              <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-1.5 px-2 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--canvas-soft)] transition-colors" aria-label="Open user menu" aria-expanded={showUserMenu}>
                <div className="w-7 h-7 rounded-full bg-[var(--primary)] flex items-center justify-center text-white font-semibold text-[10px]">{user?.name?.charAt(0).toUpperCase() || "?"}</div>
                <ChevronDown size={12} className="text-[var(--mute)]" />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--canvas)] rounded-[var(--radius-lg)] shadow-[var(--shadow-hairline),var(--shadow-level-3)] overflow-hidden z-50 animate-fade-in">
                  <div className="px-4 py-3 border-b border-[var(--hairline)]">
                    <div className="text-sm font-medium text-[var(--ink)]">{user?.name}</div>
                    <div className="font-mono text-[10px] text-[var(--mute)]">{user?.role}</div>
                  </div>
                  {users.length > 1 && <div className="py-1 border-b border-[var(--hairline)]">{users.filter(u => u.id !== user?.id).slice(0, 8).map(u => (
                    <button key={u.id} onClick={() => switchUser(u)} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[var(--ink)] hover:bg-[var(--canvas-soft)] transition-colors">
                      <div className="w-6 h-6 rounded-full bg-[var(--canvas-soft-2)] flex items-center justify-center text-[var(--body)] font-semibold text-[9px]">{u.name.charAt(0).toUpperCase()}</div>
                      <div className="text-left"><div className="text-sm font-medium">{u.name}</div><div className="font-mono text-[10px] text-[var(--mute)]">{u.role}</div></div>
                    </button>
                  ))}</div>}
                  <div className="p-1">
                    <button type="button" onClick={handleLogout} disabled={isLoggingOut} className="w-full min-h-11 flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-sm)] text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50">
                      <LogOut size={14} aria-hidden="true" />
                      {isLoggingOut ? "Logging out..." : "Logout"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 min-h-0 bg-[var(--canvas-soft)] p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
