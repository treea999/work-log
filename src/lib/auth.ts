export const ROLES = ["Admin", "PM", "Finance", "Member", "Approver", "Auditor"] as const;
export type Role = (typeof ROLES)[number];
export function isRole(value: string): value is Role {
  return ROLES.includes(value as Role);
}


export const PERMISSIONS: Record<Role, string[]> = {
  Admin: [
    "view_projects", "create_project", "edit_project", "delete_project",
    "view_budget", "edit_budget", "create_expense", "approve_expense",
    "approve_project", "approve_budget", "export_reports", "view_audit",
    "manage_users", "manage_settings", "approve_all",
  ],
  PM: ["view_projects", "create_project", "edit_project", "view_budget", "create_expense", "approve_expense", "export_reports"],
  Finance: ["view_projects", "view_budget", "edit_budget", "create_expense", "approve_expense", "export_reports", "view_audit"],
  Member: ["view_projects", "create_expense"],
  Approver: ["view_projects", "approve_project", "approve_expense", "approve_budget"],
  Auditor: ["view_projects", "view_budget", "export_reports", "view_audit"],
};

export function hasPermission(role: string, perm: string): boolean {
  const perms = isRole(role) ? PERMISSIONS[role] : [];
  if (perms.includes("approve_all")) return true;
  return perms.includes(perm);
}

export function canApproveAmount(role: string, amount: number): boolean {
  if (hasPermission(role, "approve_all")) return true;
  const limits = [
    { max: 10000, role: "PM" },
    { max: 100000, role: "Approver" },
    { max: 500000, role: "Approver" },
    { max: Infinity, role: "Admin" },
  ];
  for (const l of limits) {
    if (amount <= l.max && l.role === role) return true;
  }
  return false;
}
