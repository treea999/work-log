export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function uid(prefix: string): string {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "\u2014";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "\u2014";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function fmtMoney(n: number | null | undefined): string {
  return (n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtNum(n: number | null | undefined): string {
  return (n || 0).toLocaleString("en-US");
}

export function daysBetween(a: string | Date, b: string | Date): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

export function daysLeft(d: string | Date): number {
  return Math.round((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function isOverdue(d: string | Date | null | undefined): boolean {
  if (!d) return false;
  return new Date(d) < new Date();
}

export function isNear(d: string | Date | null | undefined, days = 7): boolean {
  if (!d) return false;
  const left = daysLeft(d);
  return left <= days && left >= 0;
}

export function calcBudgetUsage(actual: number, budget: number): number {
  if (!budget) return 0;
  return Math.round(Math.min(100, (actual / budget) * 100));
}

export function calcHealth(progress: number, budgetPct: number, overdueTasks: number, openRisks: number): number {
  let score = 0;
  score += Math.min(progress, 100) * 0.3;
  score += Math.max(0, 100 - budgetPct) * 0.3;
  score += Math.max(0, 100 - overdueTasks * 5) * 0.2;
  score += Math.max(0, 100 - openRisks * 10) * 0.2;
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function statusPillClass(status: string): string {
  const m: Record<string, string> = {
    Draft: "bg-[var(--canvas-soft-2)] text-[var(--mute)]",
    Pending: "bg-[var(--warning-soft)] text-[var(--warning-deep)]",
    Pending_Approval: "bg-[var(--warning-soft)] text-[var(--warning-deep)]",
    Approved: "bg-[var(--link-bg-soft)] text-[var(--link-deep)]",
    Rejected: "bg-[var(--error-soft)] text-[var(--error-deep)]",
    In_Progress: "bg-[var(--canvas-soft-2)] text-[var(--link-deep)]",
    InProgress: "bg-[var(--canvas-soft-2)] text-[var(--link-deep)]",
    Completed: "bg-[var(--canvas-soft-2)] text-[var(--ink)]",
    Done: "bg-[var(--canvas-soft-2)] text-[var(--ink)]",
    Suspended: "bg-[var(--canvas-soft-2)] text-[var(--mute)]",
    Delayed: "bg-[var(--error-soft)] text-[var(--error-deep)]",
    Cancelled: "bg-[var(--canvas-soft-2)] text-[var(--mute)]",
    Closed: "bg-[var(--canvas-soft-2)] text-[var(--mute)]",
    Returned: "bg-[var(--warning-soft)] text-[var(--warning-deep)]",
    "To Start": "bg-[var(--canvas-soft-2)] text-[var(--mute)]",
    Open: "bg-[var(--error-soft)] text-[var(--error-deep)]",
    Mitigating: "bg-[var(--warning-soft)] text-[var(--warning-deep)]",
  };
  return m[status] || "bg-[var(--canvas-soft-2)] text-[var(--mute)]";
}

export function priorityClass(p: string): string {
  const m: Record<string, string> = {
    Critical: "bg-[var(--error-soft)] text-[var(--error-deep)]",
    High: "bg-[var(--warning-soft)] text-[var(--warning-deep)]",
    Medium: "bg-[var(--canvas-soft-2)] text-[var(--body)]",
    Low: "bg-[var(--canvas-soft-2)] text-[var(--mute)]",
  };
  return m[p] || "bg-[var(--canvas-soft-2)] text-[var(--mute)]";
}

export function riskClass(l: string): string {
  const m: Record<string, string> = {
    Critical: "bg-[var(--error-soft)] text-[var(--error-deep)]",
    High: "bg-[var(--warning-soft)] text-[var(--warning-deep)]",
    Medium: "bg-[var(--canvas-soft-2)] text-[var(--body)]",
    Low: "bg-[var(--canvas-soft-2)] text-[var(--mute)]",
  };
  return m[l] || "bg-[var(--canvas-soft-2)] text-[var(--mute)]";
}

export function healthClass(score: number): string {
  if (score >= 80) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

export const PROJECT_STATUSES = [
  "Draft", "Pending_Approval", "Approved", "In_Progress",
  "Suspended", "Delayed", "Completed", "Cancelled", "Closed",
];

export const PROJECT_TYPES = [
  "Software Development", "System Implementation", "Data Analytics",
  "Infrastructure", "Procurement", "Training", "Marketing",
  "Process Improvement", "Consulting", "R&D",
];

export const PRIORITIES = ["Critical", "High", "Medium", "Low"];
export const RISK_LEVELS = ["Low", "Medium", "High", "Critical"];
export const BUDGET_CATEGORIES = [
  "Salary", "Personnel", "Software", "Hardware", "Procurement",
  "Travel", "Training", "Consultant", "General", "Reserve",
];
export const EXPENSE_TYPES = ["Operational", "Capital", "Procurement", "Travel", "Training", "Consulting", "Other"];
export const APPROVAL_TYPES = [
  { id: "project_open", label: "Project Opening" },
  { id: "budget", label: "Budget Approval" },
  { id: "expense", label: "Expense" },
  { id: "procurement", label: "Procurement" },
  { id: "budget_add", label: "Budget Addition" },
  { id: "budget_transfer", label: "Budget Transfer" },
  { id: "date_change", label: "Date Change" },
  { id: "owner_change", label: "Owner Change" },
  { id: "project_close", label: "Project Closure" },
  { id: "project_cancel", label: "Project Cancellation" },
];
