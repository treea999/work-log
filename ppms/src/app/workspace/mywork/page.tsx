"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "react-hot-toast";
import {
  Calendar,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
  ChevronLeft,
  ChevronRight,
  CheckCheck,
  ListTodo,
  FileCheck,
  ShieldAlert,
  AlertOctagon,
} from "lucide-react";
import Modal from "@/components/Modal";
import {
  fmtDate,
  statusPillClass,
  priorityClass,
  isOverdue,
  daysLeft,
} from "@/lib/utils";

type UserData = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
};

type WorkItem = {
  id: string;
  projectId: string;
  project: { id: string; code: string; name: string };
  name: string;
  description: string | null;
  assigneeId: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  progress: number;
  priority: string;
  type: string;
  createdAt: string;
};

type Approval = {
  id: string;
  type: string;
  status: string;
  amount: number;
  createdAt: string;
  project: { id: string; code: string; name: string } | null;
  requester: { id: string; name: string; role: string } | null;
};

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  refId: string | null;
  read: boolean;
  createdAt: string;
};

type ProjectSummary = {
  id: string;
  name: string;
  riskLevel: string;
  status: string;
};

type UserSummary = {
  id: string;
  name: string;
};

const TAB_FILTERS = ["All", "To Do", "In Progress", "Done", "Overdue"];

const STATUS_MAP: Record<string, string> = {
  "To Do": "To Start",
  "In Progress": "In Progress",
  Done: "Done",
};

function PriorityIcon({ priority }: { priority: string }) {
  const size = 14;
  switch (priority) {
    case "Critical":
      return <AlertTriangle size={size} className="text-red-600" />;
    case "High":
      return <ArrowUp size={size} className="text-orange-600" />;
    case "Medium":
      return <Minus size={size} className="text-amber-600" />;
    case "Low":
      return <ArrowDown size={size} className="text-zinc-400" />;
    default:
      return <Minus size={size} className="text-zinc-400" />;
  }
}

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "xs" }) {
  const dim = size === "sm" ? "w-8 h-8 text-xs" : "w-5 h-5 text-[9px]";
  return (
    <div
      className={`${dim} rounded-full bg-[var(--canvas-soft-2)] flex items-center justify-center text-white font-semibold shrink-0`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function MyWorkPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [tasks, setTasks] = useState<WorkItem[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabFilter, setTabFilter] = useState("All");
  const [selectedTask, setSelectedTask] = useState<WorkItem | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [userRes, approvalsRes, notifRes, projectsRes, usersRes] =
          await Promise.all([
            fetch("/api/auth"),
            fetch("/api/approvals?status=Pending"),
            fetch("/api/notifications"),
            fetch("/api/projects"),
            fetch("/api/users"),
          ]);

        let currentUser: UserData | null = null;
        if (userRes.ok) {
          const u = await userRes.json();
          if (u.id) currentUser = u;
        }
        setUser(currentUser);

        if (approvalsRes.ok) setApprovals(await approvalsRes.json());
        if (notifRes.ok) setNotifications(await notifRes.json());
        if (projectsRes.ok) setProjects(await projectsRes.json());
        if (usersRes.ok) setUsers(await usersRes.json());

        if (currentUser) {
          const tasksRes = await fetch(
            `/api/work-items?assigneeId=${currentUser.id}`
          );
          if (tasksRes.ok) setTasks(await tasksRes.json());
        }
      } catch {
        toast.error("Failed to load my work data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const userMap = useMemo(() => {
    const m: Record<string, string> = {};
    users.forEach((u) => {
      m[u.id] = u.name;
    });
    if (user) m[user.id] = user.name;
    return m;
  }, [users, user]);

  const myTasksCount = tasks.length;
  const pendingApprovalsCount = approvals.filter(
    (a) => a.status === "Pending"
  ).length;
  const topRiskCount = projects.filter(
    (p) => p.riskLevel === "High" || p.riskLevel === "Critical"
  ).length;
  const overdueCount = tasks.filter(
    (t) => isOverdue(t.endDate) && t.status !== "Done"
  ).length;

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (tabFilter === "All") return true;
      if (tabFilter === "Overdue")
        return isOverdue(t.endDate) && t.status !== "Done";
      const mapped = STATUS_MAP[tabFilter];
      return mapped ? t.status === mapped : true;
    });
  }, [tasks, tabFilter]);

  const tasksDueByDate = useMemo(() => {
    const m: Record<string, boolean> = {};
    tasks.forEach((t) => {
      if (t.endDate && t.status !== "Done") {
        const key = t.endDate.slice(0, 10);
        m[key] = true;
      }
    });
    return m;
  }, [tasks]);

  async function handleTaskUpdate() {
    if (!selectedTask) return;
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (editStatus) body.status = editStatus;
      if (editNote.trim()) {
        body.description = editNote.trim();
      }
      const res = await fetch(`/api/work-items/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Update failed");
      const updated: WorkItem = await res.json();
      setTasks((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t))
      );
      toast.success("Task updated");
      setSelectedTask(null);
      setEditStatus("");
      setEditNote("");
    } catch {
      toast.error("Failed to update task");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprovalAction(id: string, status: string) {
    try {
      const res = await fetch("/api/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Approval ${status.toLowerCase()}`);
      setApprovals((prev) => prev.filter((a) => a.id !== id));
    } catch {
      toast.error("Failed to update approval");
    }
  }

  async function markAllRead() {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      if (!res.ok) throw new Error();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark notifications as read");
    }
  }

  function openEditModal(task: WorkItem) {
    setSelectedTask(task);
    setEditStatus(task.status);
    setEditNote("");
  }

  function prevMonth() {
    setCalMonth((prev) => {
      if (prev.month === 0)
        return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  }

  function nextMonth() {
    setCalMonth((prev) => {
      if (prev.month === 11)
        return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  }

  function renderCalendar() {
    const { year, month } = calMonth;
    const totalDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);

    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }

    return (
      <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--hairline)] p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={prevMonth}
            className="p-1 rounded-[var(--radius-xs)] hover:bg-[var(--canvas-soft)] transition-colors text-[var(--mute)]"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="font-semibold text-sm text-[var(--ink)]">
            {MONTHS[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-1 rounded-[var(--radius-xs)] hover:bg-[var(--canvas-soft)] transition-colors text-[var(--mute)]"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0">
          {DAY_NAMES.map((d) => (
            <div
              key={d}
              className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] text-center pb-2"
            >
              {d}
            </div>
          ))}
          {rows.map((row, ri) =>
            row.map((cell, ci) => {
              const dateStr =
                cell !== null
                  ? `${year}-${String(month + 1).padStart(2, "0")}-${String(cell).padStart(2, "0")}`
                  : null;
              const hasDot = dateStr ? tasksDueByDate[dateStr] : false;
              return (
                <div
                  key={`${ri}-${ci}`}
                  className="text-center py-1.5 text-xs relative"
                >
                  {cell !== null && (
                    <>
                      <span className="text-[var(--ink)]">{cell}</span>
                      {hasDot && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--primary)]" />
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  const kpiCard = (
    label: string,
    value: string | number,
    icon: React.ReactNode,
    danger = false
  ) => (
    <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--hairline)] p-4 flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">
          {label}
        </div>
        <div
          className={`text-xl font-semibold tabular-nums ${
            danger ? "text-[var(--primary)]" : "text-[var(--ink)]"
          }`}
        >
          {value}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="font-mono text-xs text-[var(--mute)] uppercase tracking-wider">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink)] tracking-tight">My Work</h1>
          <p className="text-sm text-[var(--mute)] mt-0.5 font-mono">
            Tasks, approvals & notifications
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-md)] text-sm font-medium border transition-colors ${
              showCalendar
                ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                : "bg-white text-[var(--ink)] border-[var(--hairline)] hover:bg-[var(--canvas-soft)]"
            }`}
          >
            <Calendar size={16} />
            Calendar
          </button>
        </div>
      </div>

      {/* Calendar Panel */}
      {showCalendar && (
        <div className="max-w-xs">{renderCalendar()}</div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-3">
        {kpiCard(
          "My Tasks",
          myTasksCount,
          <ListTodo size={20} className="text-[var(--canvas-soft-2)]" />
        )}
        {kpiCard(
          "Pending Approvals",
          pendingApprovalsCount,
          <FileCheck size={20} className="text-[var(--link)]" />,
          pendingApprovalsCount > 0
        )}
        {kpiCard(
          "Top Risk Projects",
          topRiskCount,
          <ShieldAlert size={20} className="text-orange-600" />,
          topRiskCount > 0
        )}
        {kpiCard(
          "Items Overdue",
          overdueCount,
          <AlertOctagon size={20} className="text-[var(--primary)]" />,
          overdueCount > 0
        )}
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-3 gap-5">
        {/* Left Column - Tasks */}
        <div className="col-span-2 space-y-4">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-white rounded-[var(--radius-lg)] border border-[var(--hairline)] p-1">
            {TAB_FILTERS.map((tab) => {
              const count =
                tab === "All"
                  ? tasks.length
                  : tab === "Overdue"
                    ? overdueCount
                    : tasks.filter((t) => {
                        const mapped = STATUS_MAP[tab];
                        return mapped ? t.status === mapped : true;
                      }).length;
              return (
                <button
                  key={tab}
                  onClick={() => setTabFilter(tab)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium transition-colors ${
                    tabFilter === tab
                      ? "bg-[var(--canvas-soft)] text-[var(--ink)]"
                      : "text-[var(--mute)] hover:text-[var(--ink)]"
                  }`}
                >
                  {tab}
                  {tab === "Overdue" && count > 0 ? (
                    <span className="font-mono text-[10px] tabular-nums bg-[var(--primary)] text-white px-1.5 py-0.5 rounded-[var(--radius-xs)]">
                      {count}
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] tabular-nums bg-[var(--hairline)] text-[var(--mute)] px-1.5 py-0.5 rounded-[var(--radius-xs)]">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Task Cards */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-[var(--radius-lg)] border border-[var(--hairline)]">
              <div className="text-4xl font-semibold text-[var(--hairline)] mb-2">
                0
              </div>
              <div className="text-sm text-[var(--mute)]">
                No tasks match this filter
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((task) => {
                const assigneeName = task.assigneeId
                  ? userMap[task.assigneeId] || task.assigneeId.slice(0, 6)
                  : "Unassigned";
                return (
                  <div
                    key={task.id}
                    onClick={() => openEditModal(task)}
                    className="bg-white rounded-[var(--radius-lg)] border border-[var(--hairline)] p-4 cursor-pointer hover:border-[var(--primary)] transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        {/* Project name */}
                        <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-0.5">
                          {task.project.name}
                        </div>
                        {/* Task name */}
                        <h3 className="text-sm font-semibold text-[var(--ink)] leading-snug mb-1">
                          {task.name}
                        </h3>
                        {/* Description */}
                        {task.description && (
                          <p className="text-xs text-[var(--mute)] line-clamp-2 mb-2">
                            {task.description}
                          </p>
                        )}
                        {/* Badges row */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-[var(--radius-xs)] ${statusPillClass(task.status)}`}
                          >
                            {task.status.replace(/_/g, " ")}
                          </span>
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-[var(--radius-xs)] inline-flex items-center gap-1 ${priorityClass(task.priority)}`}
                          >
                            <PriorityIcon priority={task.priority} />
                            {task.priority}
                          </span>
                          {task.endDate && (
                            <span
                              className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded-[var(--radius-xs)] ${
                                isOverdue(task.endDate) && task.status !== "Done"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-zinc-50 text-[var(--mute)]"
                              }`}
                            >
                              {isOverdue(task.endDate) && task.status !== "Done"
                                ? `Overdue by ${Math.abs(daysLeft(task.endDate))}d`
                                : fmtDate(task.endDate)}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Assignee avatar */}
                      <div className="shrink-0 flex flex-col items-center gap-1">
                        <Avatar name={assigneeName} size="sm" />
                        <span className="font-mono text-[9px] text-[var(--mute)] max-w-16 truncate text-center">
                          {assigneeName}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column - Approvals & Notifications */}
        <div className="space-y-4">
          {/* My Approvals */}
          <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--hairline)] p-4">
            <h2 className="text-sm font-semibold text-[var(--ink)] mb-3">
              My Approvals
            </h2>
            {approvals.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--mute)]">
                No pending approvals
              </div>
            ) : (
              <div className="space-y-2">
                {approvals.slice(0, 10).map((a) => {
                  const approvalTypeLabel = a.type.replace(/_/g, " ");
                  return (
                    <div
                      key={a.id}
                      className="border border-[var(--hairline)] rounded-[var(--radius-md)] p-3"
                    >
                      <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-0.5">
                        {a.project?.name || "\u2014"}
                      </div>
                      <div className="text-xs font-medium text-[var(--ink)] mb-1">
                        {approvalTypeLabel}
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs tabular-nums text-[var(--ink)]">
                          ${a.amount.toLocaleString()}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--mute)] tabular-nums">
                          {new Date(a.createdAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprovalAction(a.id, "Approved");
                          }}
                          className="flex-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-[var(--radius-xs)] text-xs font-medium hover:bg-emerald-100 transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApprovalAction(a.id, "Rejected");
                          }}
                          className="flex-1 px-2 py-1 bg-red-50 text-red-700 rounded-[var(--radius-xs)] text-xs font-medium hover:bg-red-100 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* My Notifications */}
          <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--hairline)] p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-[var(--ink)]">
                My Notifications
              </h2>
              {notifications.some((n) => !n.read) && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-[var(--link)] hover:underline font-medium"
                >
                  <CheckCheck size={14} />
                  Mark all read
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--mute)]">
                No notifications
              </div>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`px-3 py-2.5 rounded-[var(--radius-md)] text-sm border border-transparent ${
                      n.read
                        ? "text-[var(--mute)]"
                        : "bg-[var(--canvas-soft)] text-[var(--ink)] border-[var(--hairline)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div
                          className={`text-xs ${n.read ? "" : "font-medium"}`}
                        >
                          {n.message}
                        </div>
                        <div className="font-mono text-[10px] text-[var(--mute)] mt-0.5">
                          {new Date(n.createdAt).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      {!n.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] shrink-0 mt-1" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Task Modal */}
      <Modal
        isOpen={!!selectedTask}
        onClose={() => {
          setSelectedTask(null);
          setEditStatus("");
          setEditNote("");
        }}
        title={`Edit: ${selectedTask?.name || ""}`}
        size="sm"
      >
        {selectedTask && (
          <div className="space-y-4">
            {/* Current info */}
            <div className="space-y-1">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">
                Project
              </div>
              <div className="text-sm font-medium text-[var(--ink)]">
                {selectedTask.project.name}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1.5">
                Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--hairline)] rounded-[var(--radius-xs)] text-sm text-[var(--ink)] bg-white outline-none focus:border-[var(--primary)]"
              >
                <option value="To Start">To Start</option>
                <option value="In Progress">In Progress</option>
                <option value="Done">Done</option>
                <option value="Delayed">Delayed</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>

            {/* Note */}
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1.5">
                Note
              </label>
              <textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Add a note or update description..."
                rows={3}
                className="w-full px-3 py-2 border border-[var(--hairline)] rounded-[var(--radius-xs)] text-sm text-[var(--ink)] bg-white outline-none focus:border-[var(--primary)] placeholder:text-[var(--mute)] resize-none"
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setSelectedTask(null);
                  setEditStatus("");
                  setEditNote("");
                }}
                className="px-4 py-2 text-sm font-medium text-[var(--mute)] hover:text-[var(--ink)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTaskUpdate}
                disabled={saving}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
