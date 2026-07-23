import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const department = searchParams.get("department");

    const where: any = {};
    if (status) where.status = status;
    if (department) where.department = department;

    const projects = await prisma.project.findMany({
      where,
      include: {
        manager: { select: { id: true, name: true, email: true, role: true } },
        members: { include: { user: { select: { id: true, name: true, role: true } } } },
        _count: { select: { expenses: true, workItems: true, risks: true, approvals: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(projects);
  } catch (error) {
    console.error("Projects GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const project = await prisma.project.create({
      data: {
        code: body.code,
        name: body.name,
        description: body.description,
        objective: body.objective,
        type: body.type,
        department: body.department,
        sponsor: body.sponsor,
        managerId: body.managerId,
        secrecy: body.secrecy || "Normal",
        location: body.location,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        priority: body.priority || "Medium",
        status: body.status || "Draft",
        budget: body.budget || 0,
        fiscalYear: body.fiscalYear,
        budgetSource: body.budgetSource,
        budgetType: body.budgetType,
        capitalBudget: body.capitalBudget || 0,
        operatingBudget: body.operatingBudget || 0,
        personnelBudget: body.personnelBudget || 0,
        procurementBudget: body.procurementBudget || 0,
        travelBudget: body.travelBudget || 0,
        reserveBudget: body.reserveBudget || 0,
        budgetNotes: body.budgetNotes,
        createdBy: user.id,
      },
      include: {
        manager: { select: { id: true, name: true, email: true, role: true } },
        members: { include: { user: { select: { id: true, name: true, role: true } } } },
      },
    });

    return Response.json(project, { status: 201 });
  } catch (error) {
    console.error("Projects POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
