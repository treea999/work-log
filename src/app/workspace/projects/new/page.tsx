"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import {
  ArrowLeft, Save, Plus, Trash2, X,
} from "lucide-react";
import {
  daysBetween, PROJECT_STATUSES,
} from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type UserBrief = { id: string; name: string; email: string; role: string; department: string | null };

type RiskEntry = {
  description: string;
  impact: string;
  probability: string;
  severity: string;
};

type FormData = {
  code: string;
  name: string;
  objective: string;
  description: string;
  department: string;
  type: string;
  status: string;
  fiscalYear: string;
  startDate: string;
  endDate: string;
  budget: number;
  currency: string;
  categories: Record<string, number>;
  managerId: string;
  teamMemberIds: string[];
  risks: RiskEntry[];
};

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const DEPARTMENTS = [
  "Information Technology", "Finance", "Marketing", "Operations",
  "Human Resources", "Engineering", "Research & Development", "Sales", "Legal", "Procurement",
];

const PROJECT_TYPES = ["capex", "opex", "internal", "commercial"];

const BUDGET_CATEGORIES = [
  { key: "equipment", label: "Equipment" },
  { key: "software", label: "Software" },
  { key: "labor", label: "Labor" },
  { key: "consulting", label: "Consulting" },
  { key: "training", label: "Training" },
  { key: "contingency", label: "Contingency" },
];

const RISK_LEVELS = ["Low", "Medium", "High", "Critical"];

const emptyForm: FormData = {
  code: "",
  name: "",
  objective: "",
  description: "",
  department: "",
  type: "",
  status: "Draft",
  fiscalYear: new Date().getFullYear().toString(),
  startDate: "",
  endDate: "",
  budget: 0,
  currency: "THB",
  categories: Object.fromEntries(BUDGET_CATEGORIES.map((c) => [c.key, 0])),
  managerId: "",
  teamMemberIds: [],
  risks: [],
};

const emptyRisk: RiskEntry = { description: "", impact: "Medium", probability: "Medium", severity: "Medium" };

/* ------------------------------------------------------------------ */
/*  Main Page                                                         */
/* ------------------------------------------------------------------ */

export default function ProjectNewPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--canvas-soft)] flex items-center justify-center">
        <div className="font-mono text-xs text-[var(--mute)] uppercase tracking-wider">Loading...</div>
      </div>
    }>
      <ProjectNewPage />
    </Suspense>
  );
}

function ProjectNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEdit = Boolean(editId);

  const [form, setForm] = useState<FormData>(emptyForm);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const usersRes = await fetch("/api/users");
        if (usersRes.ok) setUsers(await usersRes.json());

        if (editId) {
          const projRes = await fetch(`/api/projects/${editId}`);
          if (!projRes.ok) { toast.error("Project not found"); router.push("/projects"); return; }
          const data = await projRes.json();
          setForm({
            code: data.code || "",
            name: data.name || "",
            objective: data.objective || "",
            description: data.description || "",
            department: data.department || "",
            type: data.type || "",
            status: data.status || "Draft",
            fiscalYear: data.fiscalYear || new Date().getFullYear().toString(),
            startDate: data.startDate ? data.startDate.slice(0, 10) : "",
            endDate: data.endDate ? data.endDate.slice(0, 10) : "",
            budget: data.budget || 0,
            currency: data.currency || "THB",
            categories: {
              equipment: data.capitalBudget ?? 0,
              software: data.operatingBudget ?? 0,
              labor: data.personnelBudget ?? 0,
              consulting: data.procurementBudget ?? 0,
              training: data.travelBudget ?? 0,
              contingency: data.reserveBudget ?? 0,
            },
            managerId: data.managerId || "",
            teamMemberIds: data.members?.map((m: any) => m.userId) || [],
            risks: data.risks?.map((r: any) => ({
              description: r.description,
              impact: r.impact,
              probability: r.probability,
              severity: r.severity,
            })) || [],
          });
        }
      } catch {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [editId, router]);

  const plannedDuration = useMemo(() => {
    if (form.startDate && form.endDate) {
      return daysBetween(form.startDate, form.endDate);
    }
    return null;
  }, [form.startDate, form.endDate]);

  const totalCategoryBudget = useMemo(() => {
    return Object.values(form.categories).reduce((s, v) => s + v, 0);
  }, [form.categories]);

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateCategory(key: string, value: string) {
    const num = Math.max(0, Number(value) || 0);
    setForm((prev) => ({ ...prev, categories: { ...prev.categories, [key]: num } }));
  }

  function addRisk() {
    setForm((prev) => ({ ...prev, risks: [...prev.risks, { ...emptyRisk }] }));
  }

  function updateRisk(index: number, field: keyof RiskEntry, value: string) {
    setForm((prev) => {
      const risks = [...prev.risks];
      risks[index] = { ...risks[index], [field]: value };
      return { ...prev, risks };
    });
  }

  function removeRisk(index: number) {
    setForm((prev) => ({ ...prev, risks: prev.risks.filter((_, i) => i !== index) }));
  }

  function toggleTeamMember(userId: string) {
    setForm((prev) => ({
      ...prev,
      teamMemberIds: prev.teamMemberIds.includes(userId)
        ? prev.teamMemberIds.filter((id) => id !== userId)
        : [...prev.teamMemberIds, userId],
    }));
  }

  function validate(): boolean {
    if (!form.code) { toast.error("Project code is required"); return false; }
    if (!form.name) { toast.error("Project name is required"); return false; }
    if (!form.department) { toast.error("Department is required"); return false; }
    if (!form.startDate) { toast.error("Start date is required"); return false; }
    if (!form.endDate) { toast.error("End date is required"); return false; }
    if (new Date(form.endDate) <= new Date(form.startDate)) { toast.error("End date must be after start date"); return false; }
    if (form.budget <= 0) { toast.error("Budget must be greater than 0"); return false; }
    return true;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);

    const body: Record<string, unknown> = {
      code: form.code,
      name: form.name,
      objective: form.objective,
      description: form.description,
      department: form.department,
      type: form.type,
      status: form.status,
      fiscalYear: form.fiscalYear,
      startDate: form.startDate,
      endDate: form.endDate,
      budget: form.budget,
      currency: form.currency,
      capitalBudget: form.categories.equipment,
      operatingBudget: form.categories.software,
      personnelBudget: form.categories.labor,
      procurementBudget: form.categories.consulting,
      travelBudget: form.categories.training,
      reserveBudget: form.categories.contingency,
      managerId: form.managerId || null,
      memberIds: form.teamMemberIds,
      risks: form.risks.filter((r) => r.description),
    };

    try {
      const url = isEdit ? `/api/projects/${editId}` : "/api/projects";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || (isEdit ? "Failed to update project" : "Failed to create project"));
        return;
      }
      const saved = await res.json();
      toast.success(isEdit ? "Project updated" : "Project created");
      router.push(`/projects/${saved.id}`);
    } catch {
      toast.error(isEdit ? "Failed to update project" : "Failed to create project");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--canvas-soft)] flex items-center justify-center">
        <div className="font-mono text-xs text-[var(--mute)] uppercase tracking-wider">Loading...</div>
      </div>
    );
  }

  const selectedManager = users.find((u) => u.id === form.managerId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-[var(--radius-xs)] text-[var(--mute)] hover:text-[var(--ink)] hover:bg-white transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--ink)] tracking-tight">
              {isEdit ? "Edit Project" : "New Project"}
            </h1>
            <p className="text-sm text-[var(--mute)] mt-0.5 font-mono">
              {isEdit ? `Editing ${form.code || ""}` : "Create a new project in the portfolio"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 border border-[var(--hairline)] rounded-[var(--radius-md)] text-sm text-[var(--ink)] bg-white hover:bg-[var(--canvas-soft)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Saving..." : isEdit ? "Update Project" : "Create Project"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5 items-start">
        {/* Main content */}
        <div className="col-span-2 space-y-5">
          {/* Basic Info */}
          <section className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] p-5">
            <h2 className="font-semibold text-sm text-[var(--ink)] mb-4">Basic Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Project Code *</label>
                <input
                  value={form.code}
                  onChange={(e) => updateField("code", e.target.value)}
                  className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] font-mono"
                  placeholder="e.g. PRJ-2026-001"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Project Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                  placeholder="e.g. Cloud Migration Initiative"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Objective</label>
                <input
                  value={form.objective}
                  onChange={(e) => updateField("objective", e.target.value)}
                  className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                  placeholder="Primary goal of the project"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  rows={3}
                  className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] resize-none"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Department *</label>
                <select
                  value={form.department}
                  onChange={(e) => updateField("department", e.target.value)}
                  className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] bg-white"
                >
                  <option value="">Select department</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => updateField("type", e.target.value)}
                  className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] bg-white"
                >
                  <option value="">Select type</option>
                  {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value)}
                  className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] bg-white"
                >
                  {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Timeline */}
          <section className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] p-5">
            <h2 className="font-semibold text-sm text-[var(--ink)] mb-4">Timeline</h2>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Fiscal Year</label>
                <input
                  value={form.fiscalYear}
                  onChange={(e) => updateField("fiscalYear", e.target.value)}
                  className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] font-mono"
                  placeholder="2026"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Start Date *</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => updateField("startDate", e.target.value)}
                  className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">End Date *</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => updateField("endDate", e.target.value)}
                  className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Planned Duration</label>
                <div className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--mute)] bg-[var(--canvas-soft)] font-mono tabular-nums">
                  {plannedDuration !== null ? `${plannedDuration} days` : "\u2014"}
                </div>
              </div>
            </div>
          </section>

          {/* Budget */}
          <section className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] p-5">
            <h2 className="font-semibold text-sm text-[var(--ink)] mb-4">Budget</h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Approved Budget *</label>
                <input
                  type="number"
                  min={0}
                  value={form.budget || ""}
                  onChange={(e) => updateField("budget", Math.max(0, Number(e.target.value) || 0))}
                  className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Currency</label>
                <select
                  value={form.currency}
                  onChange={(e) => updateField("currency", e.target.value)}
                  className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] bg-white"
                >
                  <option value="THB">THB (฿)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>

            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-2">Budget Category Breakdown</label>
            <div className="grid grid-cols-2 gap-3">
              {BUDGET_CATEGORIES.map((cat) => (
                <div key={cat.key} className="flex items-center gap-2">
                  <label className="w-28 font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] shrink-0">{cat.label}</label>
                  <input
                    type="number"
                    min={0}
                    value={form.categories[cat.key] || ""}
                    onChange={(e) => updateCategory(cat.key, e.target.value)}
                    className="flex-1 border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] font-mono tabular-nums"
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end text-xs font-mono text-[var(--mute)]">
              Total breakdown: {form.currency === "THB" ? "\u0E3F" : "$"}{totalCategoryBudget.toLocaleString()} / Budget: {form.currency === "THB" ? "\u0E3F" : "$"}{form.budget.toLocaleString()}
            </div>
          </section>

          {/* Risks */}
          <section className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm text-[var(--ink)]">Risks</h2>
              <button
                onClick={addRisk}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--hairline)] rounded-[var(--radius-md)] text-xs text-[var(--ink)] hover:bg-[var(--canvas-soft)] transition-colors"
              >
                <Plus size={14} /> Add Risk
              </button>
            </div>
            {form.risks.length === 0 ? (
              <div className="text-xs text-[var(--mute)] italic">No risks added. Click &quot;Add Risk&quot; to identify project risks.</div>
            ) : (
              <div className="space-y-2">
                {form.risks.map((risk, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-[var(--canvas-soft)] rounded-[var(--radius-md)]">
                    <div className="flex-1 grid grid-cols-4 gap-2">
                      <div className="col-span-4">
                        <input
                          value={risk.description}
                          onChange={(e) => updateRisk(i, "description", e.target.value)}
                          className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-1.5 text-xs text-[var(--ink)] outline-none focus:border-[var(--primary)]"
                          placeholder="Risk description"
                        />
                      </div>
                      {(["impact", "probability", "severity"] as const).map((field) => (
                        <select
                          key={field}
                          value={risk[field]}
                          onChange={(e) => updateRisk(i, field, e.target.value)}
                          className="border border-[var(--hairline)] rounded-[var(--radius-xs)] p-1.5 text-xs text-[var(--ink)] outline-none focus:border-[var(--primary)] bg-white"
                        >
                          <option value="">{field.charAt(0).toUpperCase() + field.slice(1)}</option>
                          {RISK_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                      ))}
                    </div>
                    <button
                      onClick={() => removeRisk(i)}
                      className="p-1 text-[var(--mute)] hover:text-[var(--primary)] transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Team */}
          <section className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] p-5">
            <h2 className="font-semibold text-sm text-[var(--ink)] mb-4">Team</h2>

            {/* Manager */}
            <div className="mb-4">
              <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Project Manager</label>
              <select
                value={form.managerId}
                onChange={(e) => updateField("managerId", e.target.value)}
                className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] bg-white"
              >
                <option value="">Select manager</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
              {selectedManager && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-[var(--canvas-soft)] rounded-[var(--radius-xs)]">
                  <div className="w-6 h-6 rounded-full bg-[var(--canvas-soft-2)] flex items-center justify-center text-white font-semibold text-[9px] shrink-0">
                    {selectedManager.name.charAt(0)}
                  </div>
                  <div className="text-xs text-[var(--ink)]">{selectedManager.name}</div>
                  <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--mute)] ml-auto">{selectedManager.role}</div>
                </div>
              )}
            </div>

            {/* Team Members */}
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">
                Team Members ({form.teamMemberIds.length})
              </label>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {users
                  .filter((u) => u.id !== form.managerId)
                  .map((u) => {
                    const selected = form.teamMemberIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleTeamMember(u.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-xs)] text-xs text-left transition-colors ${
                          selected
                            ? "bg-[var(--canvas-soft)] text-[var(--ink)] border border-[var(--hairline)]"
                            : "text-[var(--mute)] hover:bg-[var(--canvas-soft)]"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-[var(--radius-xs)] border flex items-center justify-center shrink-0 ${
                          selected ? "bg-[var(--primary)] border-[var(--primary)] text-white" : "border-[var(--hairline)]"
                        }`}>
                          {selected && <X size={10} />}
                        </div>
                        <span className="truncate flex-1">{u.name}</span>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--mute)] shrink-0">{u.role}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
