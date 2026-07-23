import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const requesterId = searchParams.get("requesterId");

    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (requesterId) where.requesterId = requesterId;

    const approvals = await prisma.approval.findMany({
      where,
      include: {
        project: { select: { id: true, code: true, name: true } },
        requester: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(approvals);
  } catch (error) {
    console.error("Approvals GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    if (body.action === "update") {
      const approval = await prisma.approval.update({
        where: { id: body.id },
        data: { status: body.status },
        include: {
          project: { select: { id: true, code: true, name: true } },
          requester: { select: { id: true, name: true, role: true } },
        },
      });
      return Response.json(approval);
    }

    const approval = await prisma.approval.create({
      data: {
        type: body.type,
        refId: body.refId,
        projectId: body.projectId,
        requesterId: user.id,
        amount: body.amount || 0,
        status: "Pending",
        comments: body.comments || [],
        workflow: body.workflow || [],
        currentStep: body.currentStep || 0,
      },
      include: {
        project: { select: { id: true, code: true, name: true } },
        requester: { select: { id: true, name: true, role: true } },
      },
    });

    return Response.json(approval, { status: 201 });
  } catch (error) {
    console.error("Approvals POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const approval = await prisma.approval.update({
      where: { id: body.id },
      data: { status: body.status },
      include: {
        project: { select: { id: true, code: true, name: true } },
        requester: { select: { id: true, name: true, role: true } },
      },
    });

    return Response.json(approval);
  } catch (error) {
    console.error("Approvals PATCH error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
