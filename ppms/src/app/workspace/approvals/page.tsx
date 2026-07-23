"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  Clock, CheckCircle, XCircle, ChevronDown, Download,
  Search, User, DollarSign, MessageSquare, Paperclip, History,
  RefreshCw, FileText, Calendar,
} from "lucide-react";
import { fmtDate, fmtMoney, statusPillClass } from "@/lib/utils";
import Modal from "@/components/Modal";

type UserData = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type Approval = {
  id: string;
  type: string;
  refId: string;
  projectId: string | null;
  project: { id: string; code: string; name: string } | null;
  requesterId: string;
  requester: { id: string; name: string; role: string };
  amount: number;
  status: string;
  comments: string;
  workflow: string;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
};

type ReasonAction = {
  id: string;
  action: "Approved" | "Rejected";
} | null;

const APPROVAL_TYPES = [
  "All", "budget", "expense", "project", "milestone", "change",
];

const DATE_RANGES = ["All", "Today", "7d", "30d"];

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none w-full pl-3 pr-8 py-2 border border-[var(--hairline)] rounded-[var(--radius-xs)] text-sm text-[var(--ink)] bg-white outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "All" ? o : o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--mute)] pointer-events-none"
      />
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function avatarColor(name: string): string {
  const colors = [
    "bg-red-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
    "bg-purple-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function typeBadgeClass(type: string): string {
  const m: Record<string, string> = {
    budget: "bg-blue-50 text-blue-700 border border-blue-200",
    expense: "bg-orange-50 text-orange-700 border border-orange-200",
    project: "bg-purple-50 text-purple-700 border border-purple-200",
    milestone: "bg-cyan-50 text-cyan-700 border border-cyan-200",
    change: "bg-rose-50 text-rose-700 border border-rose-200",
  };
  return m[type] || "bg-zinc-50 text-zinc-600 border border-zinc-200";
}

export default function ApprovalsPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateRange, setDateRange] = useState("All");
  const [sortBy, setSortBy] = useState("newest");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<ReasonAction>(null);
  const [reasonText, setReasonText] = useState("");
  const [historyView, setHistoryView] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [massLoading, setMassLoading] = useState(false);

  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "All") params.set("status", statusFilter);
      if (typeFilter && typeFilter !== "All") params.set("type", typeFilter);
      const res = await fetch(`/api/approvals?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: Approval[] = await res.json();
      setApprovals(data);
    } catch {
      toast.error("Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    async function init() {
      try {
        const uRes = await fetch("/api/auth");
        if (uRes.ok) {
          const u: UserData = await uRes.json();
          if (u.id) setUser(u);
        }
      } catch {
        /* ignore */
      }
    }
    init();
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const filtered = useMemo(() => {
    let items = [...approvals];

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (a) =>
          a.project?.name?.toLowerCase().includes(q) ||
          a.project?.code?.toLowerCase().includes(q) ||
          a.requester?.name?.toLowerCase().includes(q) ||
          a.type?.toLowerCase().includes(q)
      );
    }

    if (statusFilter && statusFilter !== "All") {
      items = items.filter((a) => a.status === statusFilter);
    }

    if (typeFilter && typeFilter !== "All") {
      items = items.filter((a) => a.type === typeFilter);
    }

    if (dateRange && dateRange !== "All") {
      const now = new Date();
      let cutoff: Date;
      if (dateRange === "Today") {
        cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (dateRange === "7d") {
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else {
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      items = items.filter((a) => new Date(a.createdAt) >= cutoff);
    }

    if (historyView) {
      items = items.filter((a) => a.status !== "Pending");
    } else {
      const recentCutoff = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000);
      items = items.filter(
        (a) => a.status === "Pending" || new Date(a.updatedAt) >= recentCutoff
      );
    }

    items.sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sortBy === "oldest" ? da - db : db - da;
    });

    return items;
  }, [approvals, search, statusFilter, typeFilter, dateRange, sortBy, historyView]);

  const detailApproval = useMemo(
    () => approvals.find((a) => a.id === detailId) ?? null,
    [approvals, detailId]
  );

  function parseComments(a: Approval): { text: string; author: string; date: string }[] {
    try {
      const parsed = typeof a.comments === "string" ? JSON.parse(a.comments) : a.comments;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function parseWorkflow(a: Approval): { step: number; role: string; status: string }[] {
    try {
      const parsed = typeof a.workflow === "string" ? JSON.parse(a.workflow) : a.workflow;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function handleAction(id: string, status: string, reason?: string) {
    try {
      const res = await fetch("/api/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, comment: reason || "" }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Approval ${status.toLowerCase()}`);
      const updated = await res.json();
      setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
      setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    } catch {
      toast.error("Failed to update approval");
    }
  }

  async function handleMassAction(status: string) {
    if (selectedIds.size === 0) return;
    setMassLoading(true);
    let success = 0;
    for (const id of selectedIds) {
      try {
        const res = await fetch("/api/approvals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status }),
        });
        if (res.ok) {
          const updated = await res.json();
          setApprovals((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
          success++;
        }
      } catch {
        /* skip */
      }
    }
    toast.success(`${success} approval${success !== 1 ? "s" : ""} ${status.toLowerCase()}`);
    setSelectedIds(new Set());
    setMassLoading(false);
  }

  function handleExport() {
    try {
      setExporting(true);
      const header = "ID,Type,Project,Requester,Amount,Status,Created,Updated\n";
      const rows = filtered
        .map((a) => {
          const amt = a.amount || 0;
          return [
            a.id,
            a.type,
            a.project?.name || "",
            a.requester?.name || "",
            amt.toString(),
            a.status,
            a.createdAt,
            a.updatedAt,
          ].join(",");
        })
        .join("\n");
      const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      el.href = url;
      el.download = `approvals_${new Date().toISOString().slice(0, 10)}.csv`;
      el.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map((a) => a.id));
    });
  }

  const kpiCard = (
    label: string,
    value: string | number,
    icon: React.ReactNode,
    colorClass = "text-[var(--ink)]"
  ) => (
    <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--hairline)] p-4 flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">{label}</div>
        <div className={`text-xl font-semibold tabular-nums ${colorClass}`}>{value}</div>
      </div>
    </div>
  );

  const counts = useMemo(() => {
    const pending = approvals.filter((a) => a.status === "Pending").length;
    const approved = approvals.filter((a) => a.status === "Approved").length;
    const rejected = approvals.filter((a) => a.status === "Rejected").length;
    return { pending, approved, rejected, total: approvals.length };
  }, [approvals]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink)] tracking-tight">Approvals</h1>
          <p className="text-sm text-[var(--mute)] mt-0.5 font-mono">
            {loading ? "..." : `${filtered.length} of ${approvals.length} approval${approvals.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-[var(--mute)] font-mono tabular-nums">
                {selectedIds.size} selected
              </span>
              <button
                onClick={() => handleMassAction("Approved")}
                disabled={massLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-[var(--radius-md)] text-sm font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                <CheckCircle size={15} />
                Approve Selected
              </button>
              <button
                onClick={() => handleMassAction("Rejected")}
                disabled={massLoading}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-700 rounded-[var(--radius-md)] text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <XCircle size={15} />
                Reject Selected
              </button>
            </>
          )}
          <button
            onClick={fetchApprovals}
            className="flex items-center gap-1.5 px-3 py-2 border border-[var(--hairline)] rounded-[var(--radius-md)] text-sm font-medium text-[var(--ink)] bg-white hover:bg-[var(--canvas-soft)] transition-colors"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0 || exporting}
            className="flex items-center gap-1.5 px-4 py-2 border border-[var(--hairline)] rounded-[var(--radius-md)] text-sm font-medium text-[var(--ink)] bg-white hover:bg-[var(--canvas-soft)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={15} />
            {exporting ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {kpiCard(
          "Pending",
          counts.pending,
          <Clock size={20} className="text-amber-600" />,
          counts.pending > 0 ? "text-amber-600" : "text-[var(--ink)]"
        )}
        {kpiCard(
          "Approved",
          counts.approved,
          <CheckCircle size={20} className="text-emerald-600" />,
          "text-emerald-600"
        )}
        {kpiCard(
          "Rejected",
          counts.rejected,
          <XCircle size={20} className="text-red-600" />,
          "text-red-600"
        )}
        {kpiCard("Total", counts.total, <FileText size={20} className="text-[var(--canvas-soft-2)]" />)}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mute)]"
          />
          <input
            type="text"
            placeholder="Search by project, requester, type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[var(--hairline)] rounded-[var(--radius-xs)] text-sm text-[var(--ink)] bg-white outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] placeholder:text-[var(--mute)]"
          />
        </div>
        <FilterSelect
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setSelectedIds(new Set()); }}
          options={["All", "Pending", "Approved", "Rejected"]}
          placeholder="All Statuses"
        />
        <FilterSelect
          value={typeFilter}
          onChange={(v) => { setTypeFilter(v); setSelectedIds(new Set()); }}
          options={APPROVAL_TYPES}
          placeholder="All Types"
        />
        <FilterSelect
          value={dateRange}
          onChange={setDateRange}
          options={DATE_RANGES}
          placeholder="Date Range"
        />
        <FilterSelect
          value={sortBy}
          onChange={setSortBy}
          options={["newest", "oldest"]}
          placeholder="Sort by"
        />
        {(search || statusFilter || typeFilter || dateRange !== "All" || sortBy !== "newest") && (
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setTypeFilter("");
              setDateRange("All");
              setSortBy("newest");
            }}
            className="text-xs text-[var(--link)] hover:underline font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 border-b border-[var(--hairline)]">
        <button
          onClick={() => { setHistoryView(false); setSelectedIds(new Set()); }}
          className={`pb-2 text-sm font-medium transition-colors relative ${
            !historyView
              ? "text-[var(--ink)]"
              : "text-[var(--mute)] hover:text-[var(--ink)]"
          }`}
        >
          Pending & Recent
          {!historyView && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary)]" />
          )}
        </button>
        <button
          onClick={() => { setHistoryView(true); setSelectedIds(new Set()); }}
          className={`pb-2 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${
            historyView
              ? "text-[var(--ink)]"
              : "text-[var(--mute)] hover:text-[var(--ink)]"
          }`}
        >
          <History size={14} />
          History
          {historyView && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary)]" />
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="font-mono text-xs text-[var(--mute)] uppercase tracking-wider">Loading...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-4xl font-semibold text-[var(--hairline)] mb-2">0</div>
          <div className="text-sm text-[var(--mute)]">No approvals match your filters</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-[var(--hairline)] text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span className="text-xs text-[var(--mute)] font-mono">Select all</span>
              </label>
            </div>
          )}
          {filtered.map((a) => {
            const isPending = a.status === "Pending";
            const isSelected = selectedIds.has(a.id);
            const isExpanded = expandedId === a.id;
            const comments = parseComments(a);
            const workflow = parseWorkflow(a);

            return (
              <div
                key={a.id}
                className={`bg-white rounded-[var(--radius-lg)] border transition-all ${
                  isSelected
                    ? "border-[var(--primary)] ring-1 ring-[var(--primary)]"
                    : "border-[var(--hairline)] hover:border-[var(--primary)]"
                }`}
              >
                <div className="flex items-start gap-3 p-4">
                  <div className="pt-0.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(a.id)}
                      className="w-4 h-4 rounded border-[var(--hairline)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                  </div>

                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-semibold text-[var(--ink)] truncate">
                            {a.project?.name || "Untitled"}
                          </h3>
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-[var(--radius-xs)] ${typeBadgeClass(a.type)}`}>
                            {a.type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--mute)] line-clamp-1">
                          {a.refId || "—"}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {(a.type === "budget" || a.type === "expense") && a.amount > 0 && (
                          <div className="text-right">
                            <div className="font-mono text-sm font-semibold text-[var(--ink)] tabular-nums">
                              ฿{fmtMoney(a.amount)}
                            </div>
                          </div>
                        )}
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-[var(--radius-xs)] ${statusPillClass(a.status)}`}>
                          {a.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-6 h-6 rounded-full ${avatarColor(a.requester?.name || "?")} flex items-center justify-center text-white font-semibold text-[10px]`}
                        >
                          {initials(a.requester?.name || "?")}
                        </div>
                        <span className="text-xs text-[var(--mute)] font-mono">
                          {a.requester?.name || "—"}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-[var(--mute)]">
                        {fmtDate(a.createdAt)}
                      </span>
                      <ChevronDown
                        size={14}
                        className={`text-[var(--mute)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </div>
                  </div>

                  {isPending && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReasonModal({ id: a.id, action: "Approved" });
                        }}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-[var(--radius-xs)] text-xs font-medium hover:bg-emerald-100 transition-colors"
                      >
                        <CheckCircle size={14} className="inline mr-1" />
                        Approve
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setReasonModal({ id: a.id, action: "Rejected" });
                        }}
                        className="px-3 py-1.5 bg-red-50 text-red-700 rounded-[var(--radius-xs)] text-xs font-medium hover:bg-red-100 transition-colors"
                      >
                        <XCircle size={14} className="inline mr-1" />
                        Reject
                      </button>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-[var(--hairline)] px-4 py-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Type</div>
                        <div className="text-sm text-[var(--ink)]">{a.type.replace(/_/g, " ")}</div>
                      </div>
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Reference</div>
                        <div className="text-sm text-[var(--ink)] font-mono">{a.refId}</div>
                      </div>
                      {a.project && (
                        <>
                          <div>
                            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Project Code</div>
                            <div className="text-sm text-[var(--ink)] font-mono">{a.project.code}</div>
                          </div>
                          <div>
                            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Project</div>
                            <div className="text-sm text-[var(--ink)]">{a.project.name}</div>
                          </div>
                        </>
                      )}
                    </div>

                    {a.amount > 0 && (
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Amount</div>
                        <div className="text-lg font-semibold text-[var(--ink)] tabular-nums font-mono">
                          ฿{fmtMoney(a.amount)}
                        </div>
                      </div>
                    )}

                    {comments.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-2">
                          <MessageSquare size={12} />
                          Comments
                        </div>
                        <div className="space-y-2">
                          {comments.map((c, i) => (
                            <div key={i} className="bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-[var(--ink)]">{c.author}</span>
                                <span className="font-mono text-[10px] text-[var(--mute)]">{c.date}</span>
                              </div>
                              <p className="text-sm text-[var(--mute)]">{c.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {workflow.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-2">
                          <FileText size={12} />
                          Workflow
                        </div>
                        <div className="space-y-1">
                          {workflow.map((w, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="font-mono text-[var(--mute)]">Step {w.step}</span>
                              <span className="text-[var(--ink)]">{w.role}</span>
                              <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-[var(--radius-xs)] ${statusPillClass(w.status)}`}>
                                {w.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => setDetailId(a.id)}
                        className="text-xs text-[var(--link)] hover:underline font-medium"
                      >
                        View full details
                      </button>
                      {isPending && (
                        <span className="text-[11px] text-[var(--mute)] font-mono">
                          Ref: {a.refId}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={detailApproval !== null}
        onClose={() => setDetailId(null)}
        title="Approval Details"
        size="lg"
      >
        {detailApproval && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-[var(--radius-xs)] ${statusPillClass(detailApproval.status)}`}>
                {detailApproval.status}
              </span>
              <span className="font-mono text-[11px] text-[var(--mute)]">
                Created {fmtDate(detailApproval.createdAt)}
              </span>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[var(--ink)] mb-1">
                {detailApproval.project?.name || "Untitled"}
              </h3>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-[var(--radius-xs)] ${typeBadgeClass(detailApproval.type)}`}>
                {detailApproval.type.replace(/_/g, " ")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Reference ID</div>
                <div className="text-sm text-[var(--ink)] font-mono">{detailApproval.refId}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Requester</div>
                <div className="text-sm text-[var(--ink)]">{detailApproval.requester.name}</div>
              </div>
              {detailApproval.project && (
                <>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Project</div>
                    <div className="text-sm text-[var(--ink)]">{detailApproval.project.name}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Project Code</div>
                    <div className="text-sm text-[var(--ink)] font-mono">{detailApproval.project.code}</div>
                  </div>
                </>
              )}
              {detailApproval.amount > 0 && (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Amount</div>
                  <div className="text-lg font-semibold text-[var(--ink)] tabular-nums font-mono">
                    ฿{fmtMoney(detailApproval.amount)}
                  </div>
                </div>
              )}
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Updated</div>
                <div className="text-sm text-[var(--ink)] font-mono">{fmtDate(detailApproval.updatedAt)}</div>
              </div>
            </div>

            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-2 flex items-center gap-1.5">
                <Paperclip size={12} />
                Attachments
              </div>
              <div className="text-sm text-[var(--mute)]">No attachments</div>
            </div>

            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-2 flex items-center gap-1.5">
                <History size={12} />
                Audit Trail
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-3">
                  <div>
                    <span className="font-medium text-[var(--ink)]">{detailApproval.requester.name}</span>
                    <span className="text-[var(--mute)]"> submitted</span>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--mute)]">
                    {fmtDate(detailApproval.createdAt)}
                  </span>
                </div>
                {detailApproval.status !== "Pending" && (
                  <div className="flex items-center justify-between text-xs bg-[var(--canvas-soft)] rounded-[var(--radius-md)] p-3">
                    <div>
                      <span className="font-medium text-[var(--ink)]">System</span>
                      <span className="text-[var(--mute)]"> marked as </span>
                      <span className={`font-medium ${detailApproval.status === "Approved" ? "text-emerald-600" : "text-red-600"}`}>
                        {detailApproval.status}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-[var(--mute)]">
                      {fmtDate(detailApproval.updatedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {detailApproval.status === "Pending" && (
              <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline)]">
                <button
                  onClick={() => {
                    handleAction(detailApproval.id, "Approved");
                    setDetailId(null);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-[var(--radius-md)] text-sm font-medium hover:bg-emerald-100 transition-colors"
                >
                  <CheckCircle size={16} />
                  Approve
                </button>
                <button
                  onClick={() => {
                    setDetailId(null);
                    setReasonModal({ id: detailApproval.id, action: "Rejected" });
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-700 rounded-[var(--radius-md)] text-sm font-medium hover:bg-red-100 transition-colors"
                >
                  <XCircle size={16} />
                  Reject
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={reasonModal !== null}
        onClose={() => { setReasonModal(null); setReasonText(""); }}
        title={reasonModal?.action === "Approved" ? "Approve Request" : "Reject Request"}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--mute)]">
            {reasonModal?.action === "Approved"
              ? "Confirm approval of this request."
              : "Provide a reason for rejection."}
          </p>
          <textarea
            placeholder={reasonModal?.action === "Rejected" ? "Reason for rejection..." : "Optional comment..."}
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-[var(--hairline)] rounded-[var(--radius-xs)] text-sm text-[var(--ink)] bg-white outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] placeholder:text-[var(--mute)] resize-none"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => { setReasonModal(null); setReasonText(""); }}
              className="px-4 py-2 text-sm font-medium text-[var(--mute)] hover:text-[var(--ink)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!reasonModal) return;
                await handleAction(reasonModal.id, reasonModal.action, reasonText);
                setReasonModal(null);
                setReasonText("");
              }}
              className={`px-4 py-2 text-sm font-medium text-white rounded-[var(--radius-md)] transition-colors ${
                reasonModal?.action === "Approved"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {reasonModal?.action === "Approved" ? "Approve" : "Reject"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
