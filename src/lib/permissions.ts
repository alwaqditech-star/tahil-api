import type { SessionUser } from "./auth";

export const PETTY_CASH_RECIPIENT_ROLES = ["project_manager", "site_supervisor", "project_engineer"];

export function canViewProjectsModule(user: SessionUser): boolean {
  return user.role === "admin" || user.role === "project_manager" || user.role === "site_supervisor" || user.role === "project_engineer" || user.role === "accountant";
}

export function canPickProjectInForms(user: SessionUser): boolean {
  return canViewProjectsModule(user) || user.role === "accountant";
}

export function canViewExtracts(user: SessionUser): boolean {
  return user.role === "admin" || user.role === "project_manager" || user.role === "project_engineer" || user.role === "accountant";
}

export function canViewContracts(user: SessionUser): boolean {
  return user.role === "admin" || user.role === "project_manager" || user.role === "accountant";
}

export function canViewContractors(user: SessionUser): boolean {
  return user.role === "admin" || user.role === "project_manager" || user.role === "accountant";
}

export function canCreateResource(user: SessionUser, resource: string): boolean {
  const map: Record<string, string[]> = {
    projects: ["admin"],
    projectItems: ["admin"],
    catalogItems: ["admin", "project_manager"],
    expenses: ["admin", "project_manager", "site_supervisor", "project_engineer"],
    pettyCash: ["admin", "accountant"],
    extracts: ["admin", "project_manager", "project_engineer"],
    contractors: ["admin", "project_manager"],
    contracts: ["admin", "project_manager"],
    contractItems: ["admin", "project_manager"],
    suppliers: ["admin", "project_manager"],
    purchases: ["admin", "project_manager"],
    users: ["admin"],
    tasks: ["admin", "project_manager"],
  };
  return map[resource]?.includes(user.role) ?? false;
}

export function canEditResource(user: SessionUser, resource: string): boolean {
  const map: Record<string, string[]> = {
    projects: ["admin"],
    projectItems: ["admin"],
    catalogItems: ["admin", "project_manager"],
    expenses: ["admin", "project_manager"],
    pettyCash: ["admin", "accountant"],
    extracts: ["admin", "project_manager", "project_engineer"],
    contractors: ["admin", "project_manager"],
    contracts: ["admin", "project_manager"],
    contractItems: ["admin", "project_manager"],
    suppliers: ["admin", "project_manager"],
    purchases: ["admin", "project_manager"],
    users: ["admin"],
    tasks: ["admin", "project_manager"],
  };
  return map[resource]?.includes(user.role) ?? false;
}

export function canDeleteResource(user: SessionUser): boolean {
  return user.role === "admin";
}

export function canManagerApproveExpense(user: SessionUser): boolean {
  return user.role === "admin" || user.role === "project_manager";
}

export function canAccountantApproveExpense(user: SessionUser): boolean {
  return user.role === "admin" || user.role === "accountant";
}

export function canApproveExtractManager(user: SessionUser): boolean {
  return user.role === "admin" || user.role === "project_manager";
}

export function canApproveExtractAccountant(user: SessionUser): boolean {
  return user.role === "admin" || user.role === "accountant";
}

export function canManageTask(user: SessionUser, task: { assigneeId: number; createdById: number; projectId?: number | null }, assignedProjectIds: number[]): boolean {
  if (user.role === "admin") return true;
  if (user.id === task.assigneeId || user.id === task.createdById) return true;
  if (user.role === "project_manager" && task.projectId && assignedProjectIds.includes(task.projectId)) return true;
  return false;
}

export function canCreateTaskFor(user: SessionUser): boolean {
  return user.role === "admin" || user.role === "project_manager";
}

export function canViewAllTasks(user: SessionUser): boolean {
  return user.role === "admin";
}
