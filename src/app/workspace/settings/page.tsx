"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  User, Shield, Scale, Settings as SettingsIcon,
  Save, Plus, Trash2, RefreshCw, AlertTriangle, CheckCircle,
} from "lucide-react";
import Modal from "@/components/Modal";
import { ROLES } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type UserData = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  active: boolean;
  avatarInitial?: string;
};

type BudgetRule = {
  id: string;
  key: string;
  label: string;
  value: string;
  unit: string;
};

type SystemStats = {
  totalUsers: number;
  totalProjects: number;
  totalExpenses: number;
  totalApprovals: number;
};

/* ------------------------------------------------------------------ */
/*  Tabs                                                              */
/* ------------------------------------------------------------------ */

const TABS = ["Profile", "Users & Roles", "Budget Rules", "System"] as const;
type Tab = (typeof TABS)[number];

/* ------------------------------------------------------------------ */
/*  Main Page                                                         */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Profile");
  const [user, setUser] = useState<UserData | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [budgetRules, setBudgetRules] = useState<BudgetRule[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  /* modals */
  const [editUserModal, setEditUserModal] = useState<UserData | null>(null);
  const [addUserModal, setAddUserModal] = useState(false);
  const [clearModal, setClearModal] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [authRes, usersRes] = await Promise.all([
        fetch("/api/auth"),
        fetch("/api/users"),
      ]);
      if (authRes.ok) setUser(await authRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="font-mono text-xs text-[var(--mute)] uppercase tracking-wider">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink)] tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--mute)] mt-0.5 font-mono">System configuration and user management</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--hairline)]">
        {TABS.map((tab) => (
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
      {activeTab === "Profile" && (
        <ProfileTab user={user} onSaved={() => fetchAll()} />
      )}
      {activeTab === "Users & Roles" && (
        <UsersRolesTab
          users={users}
          onEdit={(u) => setEditUserModal(u)}
          onAdd={() => setAddUserModal(true)}
          onSaved={() => fetchAll()}
        />
      )}
      {activeTab === "Budget Rules" && (
        <BudgetRulesTab />
      )}
      {activeTab === "System" && (
        <SystemTab
          onReset={() => {
            setClearModal(false);
            fetchAll();
          }}
          onClearRequest={() => setClearModal(true)}
        />
      )}

      {/* Edit User Modal */}
      {editUserModal && (
        <EditUserModal
          user={editUserModal}
          onClose={() => setEditUserModal(null)}
          onSaved={() => { setEditUserModal(null); fetchAll(); }}
        />
      )}

      {/* Add User Modal */}
      {addUserModal && (
        <AddUserModal
          onClose={() => setAddUserModal(false)}
          onSaved={() => { setAddUserModal(false); fetchAll(); }}
        />
      )}

      {/* Clear All Data Confirmation */}
      <Modal isOpen={clearModal} onClose={() => setClearModal(false)} title="Clear All Data" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-[var(--primary)] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-[var(--ink)] font-medium">This action cannot be undone</p>
              <p className="text-xs text-[var(--mute)] mt-1">
                All projects, expenses, approvals, work items, and risks will be permanently deleted.
                User accounts will be preserved.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setClearModal(false)}
              className="px-4 py-2 border border-[var(--hairline)] rounded-[var(--radius-md)] text-sm text-[var(--ink)] hover:bg-[var(--canvas-soft)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/auth", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "clear" }),
                  });
                  if (!res.ok) { toast.error("Failed to clear data"); return; }
                  toast.success("All data cleared");
                  setClearModal(false);
                  fetchAll();
                } catch { toast.error("Failed to clear data"); }
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors"
            >
              <Trash2 size={14} />
              Delete Everything
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: Profile                                                      */
/* ------------------------------------------------------------------ */

function ProfileTab({ user, onSaved }: { user: UserData | null; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", avatarInitial: "" });
  const [password, setPassword] = useState({ current: "", newPassword: "", confirm: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ name: user.name, email: user.email, avatarInitial: user.name.charAt(0).toUpperCase() });
    }
  }, [user]);

  async function handleSave() {
    if (!form.name) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/auth", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email }),
      });
      if (!res.ok) { toast.error("Failed to update profile"); return; }
      toast.success("Profile updated");
      onSaved();
    } catch { toast.error("Failed to update profile"); }
    finally { setSaving(false); }
  }

  async function handleChangePassword() {
    if (!password.current || !password.newPassword) { toast.error("Fill in all password fields"); return; }
    if (password.newPassword !== password.confirm) { toast.error("Passwords do not match"); return; }
    if (password.newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change-password", currentPassword: password.current, newPassword: password.newPassword }),
      });
      if (!res.ok) { toast.error("Failed to change password"); return; }
      toast.success("Password changed");
      setPassword({ current: "", newPassword: "", confirm: "" });
    } catch { toast.error("Failed to change password"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Profile Info */}
      <div className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] p-5">
        <h3 className="font-semibold text-sm text-[var(--ink)] mb-4">Profile Information</h3>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xl font-semibold shrink-0">
            {user?.name?.charAt(0).toUpperCase() || "?"}
          </div>
          <div>
            <div className="text-sm font-medium text-[var(--ink)]">{user?.name || "\u2014"}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">{user?.role || "\u2014"}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Email</label>
            <input
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Role</label>
          <input
            value={user?.role || ""}
            disabled
            className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--mute)] bg-[var(--canvas-soft)] outline-none cursor-not-allowed"
          />
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] p-5">
        <h3 className="font-semibold text-sm text-[var(--ink)] mb-4">Change Password</h3>
        <div className="space-y-3">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Current Password</label>
            <input
              type="password"
              value={password.current}
              onChange={(e) => setPassword((p) => ({ ...p, current: e.target.value }))}
              className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">New Password</label>
              <input
                type="password"
                value={password.newPassword}
                onChange={(e) => setPassword((p) => ({ ...p, newPassword: e.target.value }))}
                className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
              />
            </div>
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Confirm New Password</label>
              <input
                type="password"
                value={password.confirm}
                onChange={(e) => setPassword((p) => ({ ...p, confirm: e.target.value }))}
                className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleChangePassword}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 border border-[var(--hairline)] rounded-[var(--radius-md)] text-sm text-[var(--ink)] hover:bg-[var(--canvas-soft)] transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? "Changing..." : "Change Password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: Users & Roles                                                */
/* ------------------------------------------------------------------ */

function UsersRolesTab({
  users, onEdit, onAdd, onSaved,
}: {
  users: UserData[]; onEdit: (u: UserData) => void; onAdd: () => void; onSaved: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-[var(--mute)] font-mono">{users.length} user{users.length !== 1 ? "s" : ""}</div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors"
        >
          <Plus size={16} />
          Add User
        </button>
      </div>

      <div className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--canvas-soft)] text-[var(--mute)] font-mono uppercase tracking-wider">
              <th className="text-left px-4 py-2.5 font-medium">Name</th>
              <th className="text-left px-4 py-2.5 font-medium">Email</th>
              <th className="text-left px-4 py-2.5 font-medium">Role</th>
              <th className="text-left px-4 py-2.5 font-medium">Department</th>
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
              <th className="text-right px-4 py-2.5 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs text-[var(--mute)]">No users found</td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t border-[var(--hairline)] hover:bg-[var(--canvas-soft)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[var(--canvas-soft-2)] flex items-center justify-center text-white font-semibold text-xs shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[var(--ink)] font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--mute)] font-mono text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-[var(--mute)] text-xs">{u.department || "\u2014"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-[var(--radius-xs)] ${
                      u.active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                    }`}>
                      {u.active ? <><CheckCircle size={10} /> Active</> : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onEdit(u)}
                      className="px-3 py-1 border border-[var(--hairline)] rounded-[var(--radius-xs)] text-xs text-[var(--ink)] hover:bg-[var(--canvas-soft)] transition-colors"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal: Edit User                                                  */
/* ------------------------------------------------------------------ */

function EditUserModal({ user, onClose, onSaved }: { user: UserData; onClose: () => void; onSaved: () => void }) {
  const [role, setRole] = useState(user.role);
  const [department, setDepartment] = useState(user.department || "");
  const [active, setActive] = useState(user.active);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!role) { toast.error("Role is required"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, department, active }),
      });
      if (!res.ok) { toast.error("Failed to update user"); return; }
      toast.success("User updated");
      onSaved();
    } catch { toast.error("Failed to update user"); }
    finally { setSaving(false); }
  }

  return (
    <Modal isOpen onClose={onClose} title={`Edit User: ${user.name}`} size="sm">
      <div className="space-y-3">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Name</label>
          <input value={user.name} disabled className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--mute)] bg-[var(--canvas-soft)] outline-none cursor-not-allowed" />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Email</label>
          <input value={user.email} disabled className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--mute)] bg-[var(--canvas-soft)] outline-none cursor-not-allowed" />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] bg-white"
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Department</label>
          <input
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="active"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-4 h-4 rounded-[var(--radius-xs)] border-[var(--hairline)] text-[var(--primary)] focus:ring-[var(--primary)]"
          />
          <label htmlFor="active" className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">Active</label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 border border-[var(--hairline)] rounded-[var(--radius-md)] text-sm text-[var(--ink)] hover:bg-[var(--canvas-soft)] transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
          >
            <Save size={14} />{saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal: Add User                                                   */
/* ------------------------------------------------------------------ */

function AddUserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "Member", department: "" });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.name || !form.email || !form.password) { toast.error("Name, email, and password are required"); return; }
    if (form.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", ...form }),
      });
      if (!res.ok) { toast.error("Failed to create user"); return; }
      toast.success("User created");
      onSaved();
    } catch { toast.error("Failed to create user"); }
    finally { setSaving(false); }
  }

  return (
    <Modal isOpen onClose={onClose} title="Add User" size="sm">
      <div className="space-y-3">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Name *</label>
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)]"
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)]"
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Password *</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)]"
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Role</label>
          <select
            value={form.role}
            onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
            className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] bg-white"
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] mb-1">Department</label>
          <input
            value={form.department}
            onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
            className="w-full border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)]"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 border border-[var(--hairline)] rounded-[var(--radius-md)] text-sm text-[var(--ink)] hover:bg-[var(--canvas-soft)] transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
          >
            <Save size={14} />{saving ? "Creating..." : "Create User"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: Budget Rules                                                 */
/* ------------------------------------------------------------------ */

function BudgetRulesTab() {
  const [rules, setRules] = useState<BudgetRule[]>([
    { id: "1", key: "warning_threshold", label: "Warning Threshold", value: "80", unit: "%" },
    { id: "2", key: "hard_limit_factor", label: "Hard Limit Factor", value: "1.2", unit: "x" },
    { id: "3", key: "auto_approve_up_to", label: "Auto-approve up to", value: "50000", unit: "THB" },
    { id: "4", key: "max_budget_per_project", label: "Max Budget per Project", value: "5000000", unit: "THB" },
  ]);
  const [saving, setSaving] = useState(false);

  function updateRule(key: string, value: string) {
    setRules((prev) => prev.map((r) => (r.key === key ? { ...r, value } : r)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/budget-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rules.reduce((acc, r) => ({ ...acc, [r.key]: r.value }), {})),
      });
      if (!res.ok) { toast.error("Failed to save budget rules"); return; }
      toast.success("Budget rules saved");
    } catch { toast.error("Failed to save budget rules"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] p-5">
        <h3 className="font-semibold text-sm text-[var(--ink)] mb-4">Budget Control Rules</h3>
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-3">
              <label className="w-48 font-mono text-[10px] uppercase tracking-wider text-[var(--mute)] shrink-0">
                {rule.label}
              </label>
              <div className="flex-1 flex items-center gap-2">
                <input
                  value={rule.value}
                  onChange={(e) => updateRule(rule.key, e.target.value)}
                  className="flex-1 border border-[var(--hairline)] rounded-[var(--radius-xs)] p-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] font-mono tabular-nums"
                />
                <span className="font-mono text-xs text-[var(--mute)] w-10">{rule.unit}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
          >
            <Save size={14} />{saving ? "Saving..." : "Save Rules"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: System                                                       */
/* ------------------------------------------------------------------ */

function SystemTab({ onReset, onClearRequest }: { onReset: () => void; onClearRequest: () => void }) {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [appInfo, setAppInfo] = useState({ version: "1.0.0", lastMigration: "2026-01-15" });
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [usersRes, projectsRes, expensesRes, approvalsRes] = await Promise.all([
          fetch("/api/users"),
          fetch("/api/projects/count"),
          fetch("/api/expenses/count"),
          fetch("/api/approvals/count"),
        ]);
        setStats({
          totalUsers: usersRes.ok ? (await usersRes.json()).length : 0,
          totalProjects: projectsRes.ok ? (await projectsRes.json()).count ?? 0 : 0,
          totalExpenses: expensesRes.ok ? (await expensesRes.json()).count ?? 0 : 0,
          totalApprovals: approvalsRes.ok ? (await approvalsRes.json()).count ?? 0 : 0,
        });
      } catch { /* ignore */ }
    }
    fetchStats();
  }, []);

  async function handleReset() {
    setResetting(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      if (!res.ok) { toast.error("Failed to reset sample data"); return; }
      toast.success("Sample data loaded");
      onReset();
    } catch { toast.error("Failed to reset sample data"); }
    finally { setResetting(false); }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* App Info */}
      <div className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] p-5">
        <h3 className="font-semibold text-sm text-[var(--ink)] mb-4">Application Information</h3>
        <div className="space-y-2 font-mono text-xs">
          <div className="flex items-center gap-4">
            <span className="text-[var(--mute)] w-40">Version</span>
            <span className="text-[var(--ink)] font-medium">{appInfo.version}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[var(--mute)] w-40">Last Migration</span>
            <span className="text-[var(--ink)] font-medium">{appInfo.lastMigration}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] p-5">
        <h3 className="font-semibold text-sm text-[var(--ink)] mb-4">System Statistics</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Total Users", value: stats?.totalUsers ?? 0 },
            { label: "Total Projects", value: stats?.totalProjects ?? 0 },
            { label: "Total Expenses", value: stats?.totalExpenses ?? 0 },
            { label: "Total Approvals", value: stats?.totalApprovals ?? 0 },
          ].map((s) => (
            <div key={s.label} className="bg-[var(--canvas-soft)] rounded-[var(--radius-md)] px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--mute)]">{s.label}</div>
              <div className="text-xl font-semibold font-mono tabular-nums text-[var(--ink)] mt-1">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white border border-[var(--hairline)] rounded-[var(--radius-lg)] p-5">
        <h3 className="font-semibold text-sm text-[var(--ink)] mb-4">Data Management</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-[var(--canvas-soft)] rounded-[var(--radius-md)]">
            <div>
              <div className="text-sm font-medium text-[var(--ink)]">Reset Sample Data</div>
              <div className="text-xs text-[var(--mute)] mt-0.5">Load sample projects, users, and expenses for testing</div>
            </div>
            <button
              onClick={handleReset}
              disabled={resetting}
              className="flex items-center gap-1.5 px-4 py-2 border border-[var(--hairline)] rounded-[var(--radius-md)] text-sm text-[var(--ink)] hover:bg-white transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={resetting ? "animate-spin" : ""} />
              {resetting ? "Resetting..." : "Reset Data"}
            </button>
          </div>
          <div className="flex items-center justify-between p-3 bg-red-50 rounded-[var(--radius-md)]">
            <div>
              <div className="text-sm font-medium text-[var(--primary)]">Clear All Data</div>
              <div className="text-xs text-[var(--mute)] mt-0.5">Permanently delete all projects, expenses, and approvals</div>
            </div>
            <button
              onClick={onClearRequest}
              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] text-white rounded-[var(--radius-md)] text-sm font-medium hover:bg-[var(--primary-hover)] transition-colors"
            >
              <Trash2 size={14} />
              Clear Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
