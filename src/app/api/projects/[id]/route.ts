import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, name: true, email: true, role: true } },
        members: { include: { user: { select: { id: true, name: true, role: true, department: true } } } },
        expenses: {
          include: { requester: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        workItems: { orderBy: { createdAt: "asc" } },
        risks: { orderBy: { createdAt: "desc" } },
        approvals: {
          include: { requester: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        auditLogs: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { timestamp: "desc" },
          take: 50,
        },
        notifications: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });
    return Response.json(project);
  } catch (error) {
    console.error("Project GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    const dateFields = ["startDate", "endDate"];
    const data: any = {};
    for (const [key, value] of Object.entries(body)) {
      if (key === "id") continue;
      data[key] = dateFields.includes(key) && value ? new Date(value as string) : value;
    }

    const project = await prisma.project.update({
      where: { id },
      data,
      include: {
        manager: { select: { id: true, name: true, email: true, role: true } },
        members: { include: { user: { select: { id: true, name: true, role: true } } } },
      },
    });

    return Response.json(project);
  } catch (error) {
    console.error("Project PATCH error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await prisma.project.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (error) {
    console.error("Project DELETE error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
