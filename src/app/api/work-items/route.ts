import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const projectId = searchParams.get("projectId");
    const assigneeId = searchParams.get("assigneeId");
    const status = searchParams.get("status");

    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (assigneeId) where.assigneeId = assigneeId;
    if (status) where.status = status;

    const workItems = await prisma.workItem.findMany({
      where,
      include: {
        project: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(workItems);
  } catch (error) {
    console.error("WorkItems GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const workItem = await prisma.workItem.create({
      data: {
        projectId: body.projectId,
        parentId: body.parentId,
        type: body.type || "Task",
        name: body.name,
        description: body.description,
        assigneeId: body.assigneeId,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        duration: body.duration,
        status: body.status || "To Start",
        progress: body.progress || 0,
        priority: body.priority || "Medium",
        dependsOn: body.dependsOn || [],
        relatedTo: body.relatedTo || [],
      },
      include: {
        project: { select: { id: true, code: true, name: true } },
      },
    });

    return Response.json(workItem, { status: 201 });
  } catch (error) {
    console.error("WorkItems POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
