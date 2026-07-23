"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { Search, Plus, Download, ChevronDown } from "lucide-react";
import {
  fmtDate,
  fmtMoney,
  statusPillClass,
  priorityClass,
  riskClass,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  PRIORITIES,
} from "@/lib/utils";

interface Manager {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface MemberUser {
  id: string;
  name: string;
  role: string;
}

interface Member {
  user: MemberUser;
}

interface ProjectCounts {
  expenses: number;
  workItems: number;
  risks: number;
  approvals: number;
}

interface Project {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string | null;
  department: string;
  sponsor: string | null;
  managerId: string;
  manager: Manager;
  members: Member[];
  startDate: string;
  endDate: string;
  priority: string;
  status: string;
  progress: number;
  healthScore: number;
  riskLevel: string;
  budget: number;
  fiscalYear: string | null;
  createdAt: string;
  _count: ProjectCounts;
}

const DEPARTMENTS = [
  "Information Technology",
  "Finance",
  "Marketing",
  "Operations",
  "Human Resources",
  "Engineering",
  "Research & Development",
  "Sales",
  "Legal",
  "Procurement",
];

const healthPillClass = (score: number): string => {
  if (score >= 80) return "bg-emerald-50 text-emerald-700";
  if (score >= 50) return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
};

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
            {o.replace(/_/g, " ")}
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

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  useEffect(() => {
    async function fetchProjects() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (statusFilter) params.set("status", statusFilter);
        if (deptFilter) params.set("department", deptFilter);

        const res = await fetch(`/api/projects?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setProjects(data);
      } catch {
        toast.error("Failed to load projects");
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, [statusFilter, deptFilter]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        const match =
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.manager?.name?.toLowerCase().includes(q) ||
          p.department?.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (typeFilter && p.type !== typeFilter) return false;
      if (priorityFilter && p.priority !== priorityFilter) return false;
      return true;
    });
  }, [projects, search, typeFilter, priorityFilter]);

  function handleExport() {
    try {
      const rows = filtered.map((p) => ({
        Code: p.code,
        Name: p.name,
        Department: p.department,
        Type: p.type || "",
        Status: p.status,
        Priority: p.priority,
        Manager: p.manager?.name || "",
        Budget: p.budget,
        Progress: `${p.progress}%`,
        "Health Score": p.healthScore,
        "Risk Level": p.riskLevel,
        "Start Date": fmtDate(p.startDate),
        "End Date": fmtDate(p.endDate),
        Members: p.members?.length || 0,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Projects");
      XLSX.writeFile(wb, `projects_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Projects exported");
    } catch {
      toast.error("Export failed");
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--ink)] tracking-tight">
            Projects
          </h1>
          <p className="text-sm text-[var(--mute)] mt-0.5 font-mono">
            {loading ? "..." : `${filtered.length} project${filtered.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 border border-[var(--hairline)] rounded-[var(--radius-md)] text-sm font-medium text-[var(--ink)] bg-white hover:bg-[var(--canvas-soft)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={15} />
            Export
          </button>
          <button
            onClick={() => router.push("/projects/new")}
            className="flex items-center gap-1.5 bg-[var(--primary)] text-white px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors"
          >
            <Plus size={16} />
            New Project
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mute)]"
          />
          <input
            type="text"
            placeholder="Search by name, code, manager..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[var(--hairline)] rounded-[var(--radius-xs)] text-sm text-[var(--ink)] bg-white outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] placeholder:text-[var(--mute)]"
          />
        </div>
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={PROJECT_STATUSES}
          placeholder="All Statuses"
        />
        <FilterSelect
          value={deptFilter}
          onChange={setDeptFilter}
          options={DEPARTMENTS}
          placeholder="All Departments"
        />
        <FilterSelect
          value={typeFilter}
          onChange={setTypeFilter}
          options={PROJECT_TYPES}
          placeholder="All Types"
        />
        <FilterSelect
          value={priorityFilter}
          onChange={setPriorityFilter}
          options={PRIORITIES}
          placeholder="All Priorities"
        />
        {(search || statusFilter || deptFilter || typeFilter || priorityFilter) && (
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setDeptFilter("");
              setTypeFilter("");
              setPriorityFilter("");
            }}
            className="text-xs text-[var(--link)] hover:underline font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="font-mono text-xs text-[var(--mute)] uppercase tracking-wider">
            Loading...
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-4xl font-semibold text-[var(--hairline)] mb-2">0</div>
          <div className="text-sm text-[var(--mute)]">
            No projects match your filters
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => router.push(`/projects/${p.id}`)}
              className="bg-white rounded-[var(--radius-lg)] border border-[var(--hairline)] p-5 cursor-pointer hover:border-[var(--primary)] hover:shadow-sm transition-all"
            >
              {/* Code + Name */}
              <div className="font-mono text-[11px] text-[var(--mute)] uppercase tracking-wider mb-0.5">
                {p.code}
              </div>
              <h3 className="text-base font-semibold text-[var(--ink)] leading-tight mb-3 line-clamp-2">
                {p.name}
              </h3>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <span className="text-xs text-[var(--mute)] bg-[var(--canvas-soft)] px-2 py-0.5 rounded-[var(--radius-xs)] font-mono">
                  {p.department}
                </span>
                {p.type && (
                  <span className="text-xs text-[var(--mute)] bg-[var(--canvas-soft)] px-2 py-0.5 rounded-[var(--radius-xs)] font-mono">
                    {p.type}
                  </span>
                )}
              </div>

              {/* Manager */}
              <div className="text-xs text-[var(--mute)] mb-3 font-mono">
                {p.manager?.name || "—"}
              </div>

              {/* Status + Priority + Risk pills */}
              <div className="flex flex-wrap items-center gap-1.5 mb-4">
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-[var(--radius-xs)] ${statusPillClass(p.status)}`}
                >
                  {p.status.replace(/_/g, " ")}
                </span>
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-[var(--radius-xs)] ${priorityClass(p.priority)}`}
                >
                  {p.priority}
                </span>
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-[var(--radius-xs)] ${riskClass(p.riskLevel)}`}
                >
                  {p.riskLevel}
                </span>
              </div>

              {/* Budget + Members */}
              <div className="flex items-center justify-between text-xs text-[var(--mute)] font-mono mb-3">
                <span>฿{fmtMoney(p.budget)}</span>
                <span>{p.members?.length || 0} member{(p.members?.length || 0) !== 1 ? "s" : ""}</span>
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[var(--mute)] font-mono">
                    Progress
                  </span>
                  <span className="font-mono text-[var(--ink)] font-medium">
                    {p.progress}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${p.progress}%`,
                      backgroundColor:
                        p.progress >= 80
                          ? "var(--primary)"
                          : p.progress >= 40
                            ? "#f59e0b"
                            : "var(--mute)",
                    }}
                  />
                </div>
              </div>

              {/* Health score + Date range */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-[var(--radius-xs)] ${healthPillClass(p.healthScore)}`}
                >
                  Health {p.healthScore}
                </span>
                <span className="font-mono text-[11px] text-[var(--mute)]">
                  {fmtDate(p.startDate)} – {fmtDate(p.endDate)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
