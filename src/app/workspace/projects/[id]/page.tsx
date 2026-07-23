"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Toaster, toast } from "react-hot-toast";
import {
  ArrowLeft, Edit, Download, Plus, Save,
  CheckCircle, Clock, AlertTriangle, DollarSign, PieChart,
  BarChart3, List, Columns, GitBranch,
} from "lucide-react";
import Modal from "@/components/Modal";
import {
  fmtDate, fmtDateTime, fmtMoney, daysBetween, daysLeft,
  isOverdue, isNear, calcBudgetUsage, statusPillClass, priorityClass,
  riskClass, healthClass, BUDGET_CATEGORIES,
  PRIORITIES, RISK_LEVELS, EXPENSE_TYPES,
} from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type UserBrief = { id: string; name: string; email?: string; role?: string; department?: string };
type MemberRow = { id: string; userId: string; role: string | null; user: UserBrief };
type ExpenseRow = {
  id: string; projectId: string; category: string | null; date: string | null;
  type: string | null; vendor: string | null; description: string | null;
  amountExclTax: number; tax: number; amountInclTax: number;
  invoiceNo: string | null; poNo: string | null;
  requesterId: string | null; requester: UserBrief | null;
  approvalStatus: string; paymentStatus: string;
  createdAt: string; updatedAt: string;
};
type WorkItemRow = {
  id: string; projectId: string; parentId: string | null;
  type: string; name: string; description: string | null;
  assigneeId: string | null; startDate: string | null; endDate: string | null;
  duration: number | null; status: string; progress: number;
  priority: string; dependsOn: any; relatedTo: any;
  createdAt: string; updatedAt: string;
};
type RiskRow = {
  id: string; projectId: string; description: string;
  impact: string; probability: string; severity: string;
  ownerId: string | null; preventionPlan: string | null;
  mitigationPlan: string | null; expectedCloseDate: string | null;
  status: string; createdAt: string;
};
type ApprovalRow = {
  id: string; type: string; refId: string; projectId: string | null;
  requesterId: string; requester: UserBrief;
  amount: number; status: string; comments: any; workflow: any;
  currentStep: number; createdAt: string; updatedAt: string;
};
type AuditLogRow = {
  id: string; projectId: string | null; userId: string | null;
  user: UserBrief | null; action: string; field: string | null;
  oldValue: string | null; newValue: string | null;
  comment: string | null; timestamp: string;
};
type ProjectData = {
  id: string; code: string; name: string; description: string | null;
  objective: string | null; type: string | null; department: string;
  sponsor: string | null; managerId: string; manager: UserBrief;
  secrecy: string; location: string | null;
  startDate: string; endDate: string; priority: string;
  status: string; progress: number; healthScore: number; riskLevel: string;
  budget: number; fiscalYear: string | null;
  budgetSource: string | null; budgetType: string | null;
  capitalBudget: number; operatingBudget: number;
  personnelBudget: number; procurementBudget: number;
  travelBudget: number; reserveBudget: number; budgetNotes: string | null;
  createdAt: string; updatedAt: string; createdBy: string;
  members: MemberRow[];
  expenses: ExpenseRow[];
  workItems: WorkItemRow[];
  risks: RiskRow[];
  approvals: ApprovalRow[];
  auditLogs: AuditLogRow[];
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const TABS = ["Overview", "Plan", "Budget", "Expenses", "Risks", "History"] as const;
type Tab = (typeof TABS)[number];
type PlanView = "list" | "kanban" | "gantt";

const KANBAN_COLS = [
  { key: "To Start", label: "To Start" },
  { key: "In Progress", label: "In Progress" },
  { key: "Done", label: "Done" },
];

function calcActualSpent(expenses: ExpenseRow[]): number {
  return expenses.reduce((s, e) => s + e.amountInclTax, 0);
}

function calcPendingExpenses(expenses: ExpenseRow[]): number {
  return expenses.filter(e => e.approvalStatus === "Pending").reduce((s, e) => s + e.amountInclTax, 0);
}

function calcCommittedExpenses(expenses: ExpenseRow[]): number {
  return expenses.filter(e => e.approvalStatus === "Approved" && e.paymentStatus !== "Paid").reduce((s, e) => s + e.amountInclTax, 0);
}

function calcRemaining(budget: number, spent: number): number {
  return Math.max(0, budget - spent);
}

function fmtPct(n: number): string {
  return n.toFixed(1) + "%";
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                       */
/* ------------------------------------------------------------------ */

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-[var(--mute)]">
      <div className="mb-3 opacity-40">{icon}</div>
      <div className="text-sm">{text}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                         */
/* ------------------------------------------------------------------ */

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  /* ---- data state ---- */
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ---- ui state ---- */
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [planView, setPlanView] = useState<PlanView>("list");

  /* ---- modal state ---- */
  const [modal, setModal] = useState<{
    type: "expense" | "workItem" | "risk" | "budgetAdd" | "budgetTransfer";
    editId?: string;
  } | null>(null);

  /* ---- fetch ---- */
  const fetchProject = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) { setError("Project not found"); return; }
      const data = await res.json();
      setProject(data);
    } catch {
      setError("Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  const actualSpent = project ? calcActualSpent(project.expenses) : 0;
  const pendingExpenses = project ? calcPendingExpenses(project.expenses) : 0;
  const committedExpenses = project ? calcCommittedExpenses(project.expenses) : 0;
  const remaining = project ? calcRemaining(project.budget, actualSpent) : 0;
  const usagePct = project ? calcBudgetUsage(actualSpent, project.budget) : 0;
  const openRisks = project ? project.risks.filter(r => r.status === "Open").length : 0;
  const overdueTasks = project ? project.workItems.filter(w => w.endDate && new Date(w.endDate) < new Date() && w.status !== "Done").length : 0;

  /* ---- mutations ---- */
  async function updateProject(data: Record<string, any>) {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) { toast.error("Update failed"); return; }
      const updated = await res.json();
      setProject(prev => prev ? { ...prev, ...updated } : prev);
      toast.success("Updated");
    } catch { toast.error("Update failed"); }
  }

  const handleAction = useCallback(async (action: string) => {
    if (action === "submit") await updateProject({ status: "Pending_Approval" });
    else if (action === "approve") await updateProject({ status: "Approved" });
    else if (action === "close") await updateProject({ status: "Closed" });
  }, [id]);

  /* ---- render ---- */
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--canvas-soft)] flex items-center justify-center">
        <div className="font-mono text-xs text-[var(--mute)] uppercase tracking-wider">Loading...</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[var(--canvas-soft)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-[var(--ink)] mb-2">{error || "Project not found"}</div>
          <button onClick={() => router.push("/projects")} className="text-sm text-[var(--link)] hover:underline">Back to projects</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--canvas-soft)]">
      <Toaster position="bottom-right" />

      {/* Header */}
      <div className="bg-white border-b border-[var(--hairline)] px-6 py-4">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => router.push("/projects")} className="p-1.5 rounded-[var(--radius-xs)] text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--canvas-soft)] transition-colors">
            <ArrowLeft size={18} />
          </button>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">{project.code}</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-[var(--radius-xs)] ${statusPillClass(project.status)}`}>{project.status.replace(/_/g, " ")}</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-[var(--radius-xs)] ${priorityClass(project.priority)}`}>{project.priority}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--ink)]">{project.name}</h1>
            {project.objective && <p className="text-sm text-[var(--mute)] mt-0.5">{project.objective}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => updateProject({})} className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--hairline)] rounded-[var(--radius-md)] text-sm text-[var(--ink)] hover:bg-[var(--canvas-soft)] transition-colors">
              <Edit size={14} /> Edit
            </button>
            {project.status === "Draft" && (
              <button onClick={() => handleAction("submit")} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors">
                Submit for Approval
              </button>
            )}
            {project.status === "Pending_Approval" && (
              <button onClick={() => handleAction("approve")} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-emerald-700 transition-colors">
                <CheckCircle size={14} /> Approve
              </button>
            )}
            {(project.status === "Approved" || project.status === "In_Progress") && (
              <button onClick={() => handleAction("close")} className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--hairline)] rounded-[var(--radius-md)] text-sm text-[var(--mute)] hover:text-[var(--primary)] transition-colors">
                Close Project
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body: two-column grid */}
      <div className="flex">
        {/* Left sidebar */}
        <aside className="w-72 shrink-0 border-r border-[var(--hairline)] bg-white p-5 space-y-5 overflow-y-auto max-h-[calc(100vh-9rem)]">
          {/* Status & Health */}
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-2">Status</h3>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${healthClass(project.healthScore) === "green" ? "bg-emerald-500" : healthClass(project.healthScore) === "yellow" ? "bg-amber-500" : "bg-red-500"}`} />
              <span className="text-sm font-medium text-[var(--ink)]">{project.healthScore}/100 Health</span>
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs text-[var(--mute)] mb-1">
                <span>Progress</span><span>{project.progress}%</span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: project.progress + "%", background: project.progress >= 100 ? "var(--primary)" : "var(--canvas-soft-2)" }} /></div>
            </div>
          </div>

          {/* Budget Summary */}
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-2">Budget</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-[var(--mute)]">Budget</span><span className="font-mono tabular-nums">${fmtMoney(project.budget)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-[var(--mute)]">Actual</span><span className="font-mono tabular-nums">${fmtMoney(actualSpent)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-[var(--mute)]">Remaining</span><span className="font-mono tabular-nums">${fmtMoney(remaining)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-[var(--mute)]">Usage</span><span className="font-mono tabular-nums">{usagePct}%</span></div>
            </div>
          </div>

          {/* Dates */}
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-2">Timeline</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-[var(--mute)]">Start</span><span>{fmtDate(project.startDate)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-[var(--mute)]">End</span><span className={isOverdue(project.endDate) ? "text-red-600 font-medium" : ""}>{fmtDate(project.endDate)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-[var(--mute)]">Duration</span><span>{daysBetween(project.startDate, project.endDate)} days</span></div>
              {!isOverdue(project.endDate) && <div className="flex justify-between text-xs"><span className="text-[var(--mute)]">Days Left</span><span className={isNear(project.endDate) ? "text-amber-600 font-medium" : ""}>{daysLeft(project.endDate)}</span></div>}
            </div>
          </div>

          {/* Manager & Sponsor */}
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-2">People</h3>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-[var(--mute)]">Manager</span><span className="font-medium">{project.manager.name}</span></div>
              <div className="flex justify-between text-xs"><span className="text-[var(--mute)]">Sponsor</span><span>{project.sponsor || "\u2014"}</span></div>
              <div className="flex justify-between text-xs"><span className="text-[var(--mute)]">Department</span><span>{project.department}</span></div>
              <div className="flex justify-between text-xs"><span className="text-[var(--mute)]">Fiscal Year</span><span>{project.fiscalYear || "\u2014"}</span></div>
              <div className="flex justify-between text-xs"><span className="text-[var(--mute)]">Risks</span><span>{project.risks.length} ({openRisks} open)</span></div>
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-2">Description</h3>
              <p className="text-xs text-[var(--mute)] leading-relaxed">{project.description}</p>
            </div>
          )}

          {/* Team Members */}
          <div>
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-2">Team ({project.members.length})</h3>
            <div className="space-y-1.5">
              {project.members.length === 0 ? (
                <div className="text-xs text-[var(--mute)] italic">No members</div>
              ) : (
                project.members.map(m => (
                  <div key={m.id} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[var(--canvas-soft-2)] flex items-center justify-center text-white font-semibold text-[9px] shrink-0">
                      {m.user.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-[var(--ink)] truncate">{m.user.name}</div>
                      {m.role && <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--mute)]">{m.role}</div>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Action: Add Expense */}
          <button
            onClick={() => setModal({ type: "expense" })}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-[var(--hairline)] rounded-[var(--radius-md)] text-sm text-[var(--mute)] hover:text-[var(--ink)] hover:border-[var(--mute)] transition-colors"
          >
            <Plus size={14} /> Add Expense
          </button>
        </aside>

        {/* Right content - tabs */}
        <main className="flex-1 p-6 overflow-y-auto max-h-[calc(100vh-9rem)]">
          {/* Tab bar */}
          <div className="flex gap-1 mb-6 border-b border-[var(--hairline)]">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-[1px] transition-colors ${
                  activeTab === tab
                    ? "border-[var(--primary)] text-[var(--ink)]"
                    : "border-transparent text-[var(--mute)] hover:text-[var(--ink)]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "Overview" && <OverviewTab project={project} actualSpent={actualSpent} remaining={remaining} usagePct={usagePct} openRisks={openRisks} overdueTasks={overdueTasks} />}
          {activeTab === "Plan" && <PlanTab project={project} planView={planView} setPlanView={setPlanView} onCreate={() => setModal({ type: "workItem" })} onEdit={(wi) => setModal({ type: "workItem", editId: wi.id })} />}
          {activeTab === "Budget" && <BudgetTab project={project} actualSpent={actualSpent} pendingExpenses={pendingExpenses} committedExpenses={committedExpenses} remaining={remaining} usagePct={usagePct} onAdd={() => setModal({ type: "budgetAdd" })} onTransfer={() => setModal({ type: "budgetTransfer" })} />}
          {activeTab === "Expenses" && <ExpensesTab project={project} onEdit={(e) => setModal({ type: "expense", editId: e.id })} onAdd={() => setModal({ type: "expense" })} />}
          {activeTab === "Risks" && <RisksTab project={project} onEdit={(r) => setModal({ type: "risk", editId: r.id })} onAdd={() => setModal({ type: "risk" })} />}
          {activeTab === "History" && <HistoryTab project={project} />}
        </main>
      </div>

      {/* Modals */}
      {modal?.type === "expense" && (
        <ExpenseModal
          projectId={id}
          editId={modal.editId}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchProject(); }}
        />
      )}
      {modal?.type === "workItem" && (
        <WorkItemModal
          projectId={id}
          editId={modal.editId}
          workItems={project.workItems}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchProject(); }}
        />
      )}
      {modal?.type === "risk" && (
        <RiskModal
          projectId={id}
          editId={modal.editId}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchProject(); }}
        />
      )}
      {modal?.type === "budgetAdd" && (
        <BudgetAddModal
          projectId={id}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchProject(); }}
        />
      )}
      {modal?.type === "budgetTransfer" && (
        <BudgetTransferModal
          projectId={id}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchProject(); }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: Overview                                                     */
/* ------------------------------------------------------------------ */

function OverviewTab({ project, actualSpent, remaining, usagePct, openRisks, overdueTasks }: {
  project: ProjectData; actualSpent: number; remaining: number;
  usagePct: number; openRisks: number; overdueTasks: number;
}) {
  const kpis = [
    { label: "Budget", value: `$${fmtMoney(project.budget)}`, icon: <DollarSign size={16} />, color: "text-emerald-600" },
    { label: "Actual", value: `$${fmtMoney(actualSpent)}`, icon: <BarChart3 size={16} />, color: "text-blue-600" },
    { label: "Remaining", value: `$${fmtMoney(remaining)}`, icon: <PieChart size={16} />, color: "text-amber-600" },
    { label: "Usage", value: fmtPct(usagePct), icon: <BarChart3 size={16} />, color: usagePct > 80 ? "text-red-600" : "text-[var(--ink)]" },
    { label: "Progress", value: project.progress + "%", icon: <CheckCircle size={16} />, color: project.progress >= 100 ? "text-emerald-600" : "text-[var(--ink)]" },
    { label: "Open Risks", value: String(openRisks), icon: <AlertTriangle size={16} />, color: openRisks > 0 ? "text-red-600" : "text-emerald-600" },
    { label: "Overdue Tasks", value: String(overdueTasks), icon: <Clock size={16} />, color: overdueTasks > 0 ? "text-red-600" : "text-emerald-600" },
    { label: "Health", value: project.healthScore + "/100", icon: <CheckCircle size={16} />, color: project.healthScore >= 80 ? "text-emerald-600" : project.healthScore >= 50 ? "text-amber-600" : "text-red-600" },
  ];

  const categories = [
    { name: "Capital", budgeted: project.capitalBudget, actual: 0 },
    { name: "Operating", budgeted: project.operatingBudget, actual: 0 },
    { name: "Personnel", budgeted: project.personnelBudget, actual: 0 },
    { name: "Procurement", budgeted: project.procurementBudget, actual: 0 },
    { name: "Travel", budgeted: project.travelBudget, actual: 0 },
    { name: "Reserve", budgeted: project.reserveBudget, actual: 0 },
  ];

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={k.color}>{k.icon}</span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--mute)]">{k.label}</span>
            </div>
            <div className="text-lg font-semibold font-mono tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Budget Breakdown */}
      <div className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] p-5">
        <h3 className="font-semibold text-sm text-[var(--ink)] mb-4">Budget Breakdown</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[var(--mute)] font-mono uppercase tracking-wider border-b border-[var(--hairline)]">
              <th className="text-left pb-2 font-medium">Category</th>
              <th className="text-right pb-2 font-medium">Budgeted</th>
              <th className="text-right pb-2 font-medium">Progress</th>
            </tr>
          </thead>
          <tbody>
            {categories.filter(c => c.budgeted > 0).map(c => {
              const pct = project.budget > 0 ? Math.round((c.budgeted / project.budget) * 100) : 0;
              return (
                <tr key={c.name} className="border-b border-[var(--hairline)] last:border-0">
                  <td className="py-2.5 text-[var(--ink)]">{c.name}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums">${fmtMoney(c.budgeted)}</td>
                  <td className="py-2.5 w-48">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 progress-bar">
                        <div className="progress-fill" style={{ width: pct + "%", background: "var(--canvas-soft-2)" }} />
                      </div>
                      <span className="font-mono tabular-nums w-8 text-right text-[var(--mute)]">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {categories.filter(c => c.budgeted > 0).length === 0 && (
              <tr><td colSpan={3} className="py-4 text-center text-[var(--mute)]">No budget breakdown</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: Plan                                                         */
/* ------------------------------------------------------------------ */

function PlanTab({ project, planView, setPlanView, onCreate, onEdit }: {
  project: ProjectData; planView: PlanView;
  setPlanView: (v: PlanView) => void; onCreate: () => void; onEdit: (wi: WorkItemRow) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-white border border-[var(--hairline)] rounded-[var(--radius-md)] p-0.5">
          {([["list", <List key="l" size={14} />], ["kanban", <Columns key="k" size={14} />], ["gantt", <GitBranch key="g" size={14} />]] as [PlanView, React.ReactNode][]).map(([v, icon]) => (
            <button key={v} onClick={() => setPlanView(v)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs font-medium transition-colors ${planView === v ? "bg-[var(--canvas-soft)] text-[var(--ink)]" : "text-[var(--mute)] hover:text-[var(--ink)]"}`}>
              {icon} {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCreate} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-xs font-medium hover:bg-[var(--primary-hover)] transition-colors">
            <Plus size={14} /> Add Task
          </button>
        </div>
      </div>

      {/* Views */}
      {planView === "list" && <PlanListView project={project} onEdit={onEdit} />}
      {planView === "kanban" && <PlanKanbanView project={project} />}
      {planView === "gantt" && <PlanGanttView project={project} />}
    </div>
  );
}

function PlanListView({ project, onEdit }: { project: ProjectData; onEdit: (wi: WorkItemRow) => void }) {
  const items = project.workItems;
  if (items.length === 0) return <EmptyState icon={<List size={32} />} text="No work items yet" />;

  return (
    <div className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[var(--canvas-soft)] text-[var(--mute)] font-mono uppercase tracking-wider">
            <th className="text-left px-4 py-2.5 font-medium">Name</th>
            <th className="text-left px-4 py-2.5 font-medium">Type</th>
            <th className="text-left px-4 py-2.5 font-medium">Status</th>
            <th className="text-left px-4 py-2.5 font-medium">Priority</th>
            <th className="text-right px-4 py-2.5 font-medium">Progress</th>
            <th className="text-left px-4 py-2.5 font-medium">End Date</th>
          </tr>
        </thead>
        <tbody>
          {items.map(wi => (
            <tr key={wi.id} onClick={() => onEdit(wi)} className="border-t border-[var(--hairline)] hover:bg-[var(--canvas-soft)] cursor-pointer transition-colors">
              <td className="px-4 py-2.5">
                <div className="text-[var(--ink)] font-medium">{wi.name}</div>
                {wi.description && <div className="text-[var(--mute)] truncate max-w-xs">{wi.description}</div>}
              </td>
              <td className="px-4 py-2.5 text-[var(--mute)]">{wi.type}</td>
              <td className="px-4 py-2.5"><span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-[var(--radius-xs)] ${statusPillClass(wi.status)}`}>{wi.status}</span></td>
              <td className="px-4 py-2.5"><span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-[var(--radius-xs)] ${priorityClass(wi.priority)}`}>{wi.priority}</span></td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums">{wi.progress}%</td>
              <td className={`px-4 py-2.5 font-mono tabular-nums ${wi.endDate && isOverdue(wi.endDate) && wi.status !== "Done" ? "text-red-600" : ""}`}>{fmtDate(wi.endDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlanKanbanView({ project }: { project: ProjectData }) {
  const cols = KANBAN_COLS.map(col => ({
    ...col,
    items: project.workItems.filter(wi => wi.status === col.key),
  }));

  return (
    <div className="grid grid-cols-3 gap-4">
      {cols.map(col => (
        <div key={col.key} className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] p-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-3 px-1">
            {col.label} <span className="ml-1">({col.items.length})</span>
          </div>
          <div className="space-y-2">
            {col.items.length === 0 ? (
              <div className="text-xs text-[var(--mute)] italic px-1">Empty</div>
            ) : (
              col.items.map(wi => (
                <div key={wi.id} className="border border-[var(--hairline)] rounded-[var(--radius-md)] p-3 hover:bg-[var(--canvas-soft)] transition-colors cursor-pointer">
                  <div className="text-xs font-medium text-[var(--ink)] mb-1">{wi.name}</div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-mono px-1 py-0.5 rounded-[var(--radius-xs)] ${priorityClass(wi.priority)}`}>{wi.priority}</span>
                    <span className="font-mono text-[9px] text-[var(--mute)]">{wi.progress}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlanGanttView({ project }: { project: ProjectData }) {
  const items = project.workItems.filter(wi => wi.startDate && wi.endDate);
  if (items.length === 0) return <EmptyState icon={<GitBranch size={32} />} text="No work items with dates" />;

  const start = new Date(Math.min(...items.map(wi => new Date(wi.startDate!).getTime())));
  const end = new Date(Math.max(...items.map(wi => new Date(wi.endDate!).getTime())));
  const totalDays = Math.max(1, daysBetween(start.toISOString(), end.toISOString()));

  const months: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const m = cur.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
    if (!months.includes(m)) months.push(m);
    cur.setMonth(cur.getMonth() + 1);
  }

  return (
    <div className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] overflow-x-auto">
      <div className="min-w-[600px] p-4">
        {/* Month headers */}
        <div className="flex mb-2" style={{ marginLeft: 200 }}>
          {months.map(m => {
            const monthStart = new Date(m);
            const w = Math.max(40, Math.round(totalDays / months.length * 20));
            return <div key={m} className="text-[9px] font-mono text-[var(--mute)] uppercase tracking-wider" style={{ width: w + "px" }}>{m}</div>;
          })}
        </div>

        {/* Rows */}
        <div className="space-y-1">
          {items.map(wi => {
            const taskStart = new Date(wi.startDate!);
            const taskEnd = new Date(wi.endDate!);
            const left = Math.max(0, daysBetween(start.toISOString(), taskStart.toISOString())) / totalDays * 100;
            const width = Math.max(2, daysBetween(taskStart.toISOString(), taskEnd.toISOString())) / totalDays * 100;
            const color = wi.status === "Done" ? "bg-emerald-400" : wi.status === "In Progress" ? "bg-blue-500" : "bg-zinc-300";
            return (
              <div key={wi.id} className="flex items-center gap-2 py-1">
                <div className="w-[195px] shrink-0 text-xs text-[var(--ink)] truncate" title={wi.name}>{wi.name}</div>
                <div className="flex-1 relative h-5">
                  <div className="absolute inset-0 bg-[var(--hairline)] rounded-[var(--radius-xs)]" />
                  <div className={`absolute top-0.5 h-4 rounded-[var(--radius-xs)] ${color} transition-all`} style={{ left: left + "%", width: width + "%", minWidth: 4 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: Budget                                                       */
/* ------------------------------------------------------------------ */

function BudgetTab({ project, actualSpent, pendingExpenses, committedExpenses, remaining, usagePct, onAdd, onTransfer }: {
  project: ProjectData; actualSpent: number; pendingExpenses: number;
  committedExpenses: number; remaining: number; usagePct: number;
  onAdd: () => void; onTransfer: () => void;
}) {
  const kpis = [
    { label: "Approved Budget", value: `$${fmtMoney(project.budget)}`, color: "text-emerald-600" },
    { label: "Actual Spent", value: `$${fmtMoney(actualSpent)}`, color: "text-blue-600" },
    { label: "Pending Approval", value: `$${fmtMoney(pendingExpenses)}`, color: "text-amber-600" },
    { label: "Available", value: `$${fmtMoney(remaining)}`, color: remaining > 0 ? "text-emerald-600" : "text-red-600" },
    { label: "Committed", value: `$${fmtMoney(committedExpenses)}`, color: "text-orange-600" },
    { label: "Usage", value: fmtPct(usagePct), color: usagePct > 80 ? "text-red-600" : "text-[var(--ink)]" },
    { label: "Forecast", value: `$${fmtMoney(actualSpent + pendingExpenses)}`, color: actualSpent + pendingExpenses > project.budget ? "text-red-600" : "text-[var(--ink)]" },
  ];

  const changes = project.approvals.filter(a => a.type === "budget_add" || a.type === "budget_transfer");

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] p-4">
            <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--mute)] mb-1">{k.label}</div>
            <div className={`text-base font-semibold font-mono tabular-nums ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-xs font-medium hover:bg-[var(--primary-hover)] transition-colors">
          <Plus size={14} /> Request Budget Addition
        </button>
        <button onClick={onTransfer} className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--hairline)] rounded-[var(--radius-md)] text-xs text-[var(--ink)] hover:bg-[var(--canvas-soft)] transition-colors">
          Transfer Budget
        </button>
      </div>

      {/* Change History */}
      <div className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] p-5">
        <h3 className="font-semibold text-sm text-[var(--ink)] mb-4">Budget Change History</h3>
        {changes.length === 0 ? (
          <div className="text-xs text-[var(--mute)] italic">No changes</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[var(--mute)] font-mono uppercase tracking-wider border-b border-[var(--hairline)]">
                <th className="text-left pb-2 font-medium">Date</th>
                <th className="text-left pb-2 font-medium">Type</th>
                <th className="text-left pb-2 font-medium">Requester</th>
                <th className="text-right pb-2 font-medium">Amount</th>
                <th className="text-left pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {changes.map(c => (
                <tr key={c.id} className="border-b border-[var(--hairline)] last:border-0">
                  <td className="py-2.5 font-mono tabular-nums">{fmtDate(c.createdAt)}</td>
                  <td className="py-2.5 text-[var(--ink)]">{c.type.replace(/_/g, " ")}</td>
                  <td className="py-2.5">{c.requester.name}</td>
                  <td className="py-2.5 text-right font-mono tabular-nums">${fmtMoney(c.amount)}</td>
                  <td className="py-2.5"><span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-[var(--radius-xs)] ${statusPillClass(c.status)}`}>{c.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: Expenses                                                     */
/* ------------------------------------------------------------------ */

function ExpensesTab({ project, onEdit, onAdd }: {
  project: ProjectData; onEdit: (e: ExpenseRow) => void; onAdd: () => void;
}) {
  const expenses = project.expenses;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-[var(--mute)]">{expenses.length} expenses</div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--hairline)] rounded-[var(--radius-md)] text-xs text-[var(--ink)] hover:bg-[var(--canvas-soft)] transition-colors">
            <Download size={14} /> Export
          </button>
          <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-xs font-medium hover:bg-[var(--primary-hover)] transition-colors">
            <Plus size={14} /> Add Expense
          </button>
        </div>
      </div>

      {expenses.length === 0 ? (
        <EmptyState icon={<DollarSign size={32} />} text="No expenses recorded" />
      ) : (
        <div className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--canvas-soft)] text-[var(--mute)] font-mono uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-medium">Date</th>
                <th className="text-left px-4 py-2.5 font-medium">Description</th>
                <th className="text-left px-4 py-2.5 font-medium">Category</th>
                <th className="text-left px-4 py-2.5 font-medium">Vendor</th>
                <th className="text-right px-4 py-2.5 font-medium">Amount</th>
                <th className="text-left px-4 py-2.5 font-medium">Approval</th>
                <th className="text-left px-4 py-2.5 font-medium">Payment</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id} onClick={() => onEdit(e)} className="border-t border-[var(--hairline)] hover:bg-[var(--canvas-soft)] cursor-pointer transition-colors">
                  <td className="px-4 py-2.5 font-mono tabular-nums text-[var(--mute)]">{fmtDate(e.date)}</td>
                  <td className="px-4 py-2.5 text-[var(--ink)]">{e.description || "\u2014"}</td>
                  <td className="px-4 py-2.5 text-[var(--mute)]">{e.category || "\u2014"}</td>
                  <td className="px-4 py-2.5">{e.vendor || "\u2014"}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">${fmtMoney(e.amountInclTax)}</td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-[var(--radius-xs)] ${statusPillClass(e.approvalStatus)}`}>{e.approvalStatus}</span></td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-[var(--radius-xs)] ${e.paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-700" : e.paymentStatus === "Partial" ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-500"}`}>{e.paymentStatus}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: Risks                                                        */
/* ------------------------------------------------------------------ */

function RisksTab({ project, onEdit, onAdd }: {
  project: ProjectData; onEdit: (r: RiskRow) => void; onAdd: () => void;
}) {
  const risks = project.risks;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-[var(--mute)]">{risks.length} risks ({risks.filter(r => r.status === "Open").length} open)</div>
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-xs font-medium hover:bg-[var(--primary-hover)] transition-colors">
          <Plus size={14} /> Add Risk
        </button>
      </div>

      {risks.length === 0 ? (
        <EmptyState icon={<AlertTriangle size={32} />} text="No risks identified" />
      ) : (
        <div className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--canvas-soft)] text-[var(--mute)] font-mono uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-medium">Description</th>
                <th className="text-left px-4 py-2.5 font-medium">Impact</th>
                <th className="text-left px-4 py-2.5 font-medium">Probability</th>
                <th className="text-left px-4 py-2.5 font-medium">Severity</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Close Date</th>
              </tr>
            </thead>
            <tbody>
              {risks.map(r => (
                <tr key={r.id} onClick={() => onEdit(r)} className="border-t border-[var(--hairline)] hover:bg-[var(--canvas-soft)] cursor-pointer transition-colors">
                  <td className="px-4 py-2.5 text-[var(--ink)] max-w-xs truncate">{r.description}</td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-[var(--radius-xs)] ${riskClass(r.impact)}`}>{r.impact}</span></td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-[var(--radius-xs)] ${riskClass(r.probability)}`}>{r.probability}</span></td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-[var(--radius-xs)] ${riskClass(r.severity)}`}>{r.severity}</span></td>
                  <td className="px-4 py-2.5"><span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-[var(--radius-xs)] ${statusPillClass(r.status)}`}>{r.status}</span></td>
                  <td className="px-4 py-2.5 font-mono tabular-nums text-[var(--mute)]">{fmtDate(r.expectedCloseDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: History                                                      */
/* ------------------------------------------------------------------ */

function HistoryTab({ project }: { project: ProjectData }) {
  const logs = project.auditLogs;
  if (logs.length === 0) return <EmptyState icon={<Clock size={32} />} text="No history recorded" />;

  return (
    <div className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[var(--canvas-soft)] text-[var(--mute)] font-mono uppercase tracking-wider">
            <th className="text-left px-4 py-2.5 font-medium">Timestamp</th>
            <th className="text-left px-4 py-2.5 font-medium">User</th>
            <th className="text-left px-4 py-2.5 font-medium">Action</th>
            <th className="text-left px-4 py-2.5 font-medium">Field</th>
            <th className="text-left px-4 py-2.5 font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} className="border-t border-[var(--hairline)]">
              <td className="px-4 py-2.5 font-mono tabular-nums text-[var(--mute)] whitespace-nowrap">{fmtDateTime(log.timestamp)}</td>
              <td className="px-4 py-2.5">{log.user?.name || "\u2014"}</td>
              <td className="px-4 py-2.5 text-[var(--ink)] font-medium">{log.action}</td>
              <td className="px-4 py-2.5 text-[var(--mute)]">{log.field || "\u2014"}</td>
              <td className="px-4 py-2.5 text-[var(--mute)] max-w-xs truncate">
                {log.comment || (log.oldValue && log.newValue ? `${log.oldValue} \u2192 ${log.newValue}` : log.newValue || log.oldValue || "\u2014")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal: Add / Edit Expense                                         */
/* ------------------------------------------------------------------ */

function ExpenseModal({ projectId, editId, onClose, onSaved }: {
  projectId: string; editId?: string; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ description: "", category: "", type: "", vendor: "", amountExclTax: 0, tax: 0, date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editId) {
      fetch(`/api/expenses?projectId=${projectId}`).then(r => r.json()).then((data: ExpenseRow[]) => {
        const e = data.find(x => x.id === editId);
        if (e) setForm({ description: e.description || "", category: e.category || "", type: e.type || "", vendor: e.vendor || "", amountExclTax: e.amountExclTax, tax: e.tax, date: e.date ? e.date.slice(0, 10) : "" });
      });
    }
  }, [editId, projectId]);

  const handleSave = async () => {
    if (!form.description) { toast.error("Description required"); return; }
    setSaving(true);
    try {
      const body = { ...form, projectId, amountInclTax: form.amountExclTax + form.tax };
      if (editId) {
        const res = await fetch(`/api/expenses/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) { toast.error("Failed to update"); return; }
      } else {
        const res = await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) { toast.error("Failed to create"); return; }
      }
      toast.success(editId ? "Updated" : "Created");
      onSaved();
    } catch { toast.error("Failed"); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title={editId ? "Edit Expense" : "Add Expense"}>
      <div className="space-y-3">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Description *</label>
          <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Category</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]">
              <option value="">Select</option>
              {BUDGET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Type</label>
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]">
              <option value="">Select</option>
              {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Vendor</label>
            <input value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]" />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Date</label>
            <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Amount (excl. tax)</label>
            <input type="number" value={form.amountExclTax} onChange={e => setForm(p => ({ ...p, amountExclTax: +e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]" />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Tax</label>
            <input type="number" value={form.tax} onChange={e => setForm(p => ({ ...p, tax: +e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--mute)] hover:text-[var(--ink)] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-40">
            <Save size={14} /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal: Add / Edit Work Item                                       */
/* ------------------------------------------------------------------ */

function WorkItemModal({ projectId, editId, workItems, onClose, onSaved }: {
  projectId: string; editId?: string; workItems: WorkItemRow[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ name: "", type: "Task", description: "", status: "To Start", priority: "Medium", progress: 0, startDate: "", endDate: "", parentId: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editId) {
      const wi = workItems.find(x => x.id === editId);
      if (wi) setForm({ name: wi.name, type: wi.type, description: wi.description || "", status: wi.status, priority: wi.priority, progress: wi.progress, startDate: wi.startDate ? wi.startDate.slice(0, 10) : "", endDate: wi.endDate ? wi.endDate.slice(0, 10) : "", parentId: wi.parentId || "" });
    }
  }, [editId, workItems]);

  const handleSave = async () => {
    if (!form.name) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      const body = { ...form, projectId };
      if (editId) {
        const res = await fetch(`/api/work-items/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) { toast.error("Update failed"); return; }
      } else {
        const res = await fetch("/api/work-items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) { toast.error("Create failed"); return; }
      }
      toast.success(editId ? "Updated" : "Created");
      onSaved();
    } catch { toast.error("Failed"); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title={editId ? "Edit Work Item" : "New Work Item"} size="lg">
      <div className="space-y-3">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Name *</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]" />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Description</label>
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)] resize-none" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Type</label>
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]">
              <option value="Task">Task</option>
              <option value="Phase">Phase</option>
              <option value="Milestone">Milestone</option>
            </select>
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]">
              {["To Start", "In Progress", "Done", "Delayed", "Cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Priority</label>
            <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]">
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Progress %</label>
            <input type="number" min={0} max={100} value={form.progress} onChange={e => setForm(p => ({ ...p, progress: +e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]" />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Start Date</label>
            <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]" />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">End Date</label>
            <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--mute)] hover:text-[var(--ink)] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-40">
            <Save size={14} /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal: Add / Edit Risk                                            */
/* ------------------------------------------------------------------ */

function RiskModal({ projectId, editId, onClose, onSaved }: {
  projectId: string; editId?: string; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ description: "", impact: "Medium", probability: "Medium", severity: "Medium", status: "Open", expectedCloseDate: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editId) {
      fetch(`/api/risks?projectId=${projectId}`).then(r => r.json()).then((data: RiskRow[]) => {
        const r = data.find(x => x.id === editId);
        if (r) setForm({ description: r.description, impact: r.impact, probability: r.probability, severity: r.severity, status: r.status, expectedCloseDate: r.expectedCloseDate ? r.expectedCloseDate.slice(0, 10) : "" });
      });
    }
  }, [editId, projectId]);

  const handleSave = async () => {
    if (!form.description) { toast.error("Description required"); return; }
    setSaving(true);
    try {
      const body = { ...form, projectId };
      if (editId) {
        const res = await fetch(`/api/risks/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) { toast.error("Update failed"); return; }
      } else {
        const res = await fetch("/api/risks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) { toast.error("Create failed"); return; }
      }
      toast.success(editId ? "Updated" : "Created");
      onSaved();
    } catch { toast.error("Failed"); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title={editId ? "Edit Risk" : "Add Risk"}>
      <div className="space-y-3">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Description *</label>
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)] resize-none" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Impact</label>
            <select value={form.impact} onChange={e => setForm(p => ({ ...p, impact: e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]">
              {RISK_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Probability</label>
            <select value={form.probability} onChange={e => setForm(p => ({ ...p, probability: e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]">
              {RISK_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Severity</label>
            <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]">
              {RISK_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]">
              {["Open", "Mitigating", "Closed"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Expected Close Date</label>
            <input type="date" value={form.expectedCloseDate} onChange={e => setForm(p => ({ ...p, expectedCloseDate: e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--mute)] hover:text-[var(--ink)] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-40">
            <Save size={14} /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal: Budget Addition Request                                    */
/* ------------------------------------------------------------------ */

function BudgetAddModal({ projectId, onClose, onSaved }: {
  projectId: string; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ amount: 0, reason: "" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (form.amount <= 0) { toast.error("Amount must be > 0"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, type: "budget_add", amount: form.amount, comment: form.reason }),
      });
      if (!res.ok) { toast.error("Failed"); return; }
      toast.success("Budget addition request submitted");
      onSaved();
    } catch { toast.error("Failed"); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Request Budget Addition">
      <div className="space-y-3">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Amount ($)</label>
          <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: +e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]" />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Reason</label>
          <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} rows={3} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)] resize-none" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--mute)] hover:text-[var(--ink)] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-40">
            <Save size={14} /> {saving ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal: Budget Transfer                                            */
/* ------------------------------------------------------------------ */

function BudgetTransferModal({ projectId, onClose, onSaved }: {
  projectId: string; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ fromCategory: "", toCategory: "", amount: 0, reason: "" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (form.amount <= 0) { toast.error("Amount must be > 0"); return; }
    if (!form.fromCategory || !form.toCategory) { toast.error("Select categories"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, type: "budget_transfer", amount: form.amount, comment: `Transfer from ${form.fromCategory} to ${form.toCategory}: ${form.reason}` }),
      });
      if (!res.ok) { toast.error("Failed"); return; }
      toast.success("Transfer request submitted");
      onSaved();
    } catch { toast.error("Failed"); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title="Transfer Budget">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">From Category</label>
            <select value={form.fromCategory} onChange={e => setForm(p => ({ ...p, fromCategory: e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]">
              <option value="">Select</option>
              {BUDGET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">To Category</label>
            <select value={form.toCategory} onChange={e => setForm(p => ({ ...p, toCategory: e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]">
              <option value="">Select</option>
              {BUDGET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Amount ($)</label>
          <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: +e.target.value }))} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)]" />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Reason</label>
          <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} rows={2} className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm outline-none focus:border-[var(--primary)] resize-none" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--mute)] hover:text-[var(--ink)] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-40">
            <Save size={14} /> {saving ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
