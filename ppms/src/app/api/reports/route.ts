import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type");

    if (type === "project-summary") {
      const [total, byStatus, byDepartment] = await Promise.all([
        prisma.project.count(),
        prisma.project.groupBy({ by: ["status"], _count: true }),
        prisma.project.groupBy({ by: ["department"], _count: true }),
      ]);
      return Response.json({ total, byStatus, byDepartment });
    }

    if (type === "budget-summary") {
      const projects = await prisma.project.findMany({
        select: {
          id: true, code: true, name: true, budget: true,
          capitalBudget: true, operatingBudget: true,
          personnelBudget: true, procurementBudget: true,
          travelBudget: true, reserveBudget: true,
        },
      });
      const expenses = await prisma.expense.groupBy({
        by: ["projectId"],
        _sum: { amountInclTax: true },
      });
      const expenseMap = new Map(expenses.map((e) => [e.projectId, e._sum.amountInclTax || 0]));
      const data = projects.map((p) => ({
        ...p,
        totalBudget: p.budget,
        actualSpend: expenseMap.get(p.id) || 0,
        usagePercent: p.budget > 0 ? Math.round((expenseMap.get(p.id) || 0) / p.budget * 100) : 0,
      }));
      return Response.json(data);
    }

    if (type === "performance") {
      const projects = await prisma.project.findMany({
        select: { id: true, code: true, name: true, progress: true, healthScore: true, status: true },
      });
      return Response.json(projects);
    }

    if (type === "audit") {
      const projectId = searchParams.get("projectId");
      const where: any = {};
      if (projectId) where.projectId = projectId;

      const logs = await prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true } } },
        orderBy: { timestamp: "desc" },
        take: 200,
      });
      return Response.json(logs);
    }

    if (type === "risk") {
      const [total, bySeverity, byStatus] = await Promise.all([
        prisma.risk.count(),
        prisma.risk.groupBy({ by: ["severity"], _count: true }),
        prisma.risk.groupBy({ by: ["status"], _count: true }),
      ]);
      const projectRisks = await prisma.risk.groupBy({
        by: ["projectId"],
        _count: true,
      });
      const projectIds = projectRisks.map((r) => r.projectId);
      const projects = await prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, code: true, name: true },
      });
      const projectMap = new Map(projects.map((p) => [p.id, p]));
      return Response.json({
        total,
        bySeverity,
        byStatus,
        byProject: projectRisks.map((r) => ({
          project: projectMap.get(r.projectId),
          count: r._count,
        })),
      });
    }

    if (type === "expense") {
      const projectId = searchParams.get("projectId");
      const where: any = {};
      if (projectId) where.projectId = projectId;

      const [total, byCategory, byStatus, expenses] = await Promise.all([
        prisma.expense.aggregate({ where, _sum: { amountInclTax: true } }),
        prisma.expense.groupBy({ by: ["category"], _sum: { amountInclTax: true } }),
        prisma.expense.groupBy({ by: ["approvalStatus"], _count: true }),
        prisma.expense.findMany({
          where,
          include: {
            project: { select: { id: true, code: true, name: true } },
            requester: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      ]);
      return Response.json({ total: total._sum.amountInclTax || 0, byCategory, byStatus, expenses });
    }

    return Response.json({ error: "Invalid report type" }, { status: 400 });
  } catch (error) {
    console.error("Reports GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
