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
    const severity = searchParams.get("severity");

    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (severity) where.severity = severity;

    const risks = await prisma.risk.findMany({
      where,
      include: {
        project: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(risks);
  } catch (error) {
    console.error("Risks GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const risk = await prisma.risk.create({
      data: {
        projectId: body.projectId,
        description: body.description,
        impact: body.impact || "Medium",
        probability: body.probability || "Medium",
        severity: body.severity || "Medium",
        ownerId: body.ownerId,
        preventionPlan: body.preventionPlan,
        mitigationPlan: body.mitigationPlan,
        expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : undefined,
        status: body.status || "Open",
      },
      include: {
        project: { select: { id: true, code: true, name: true } },
      },
    });

    return Response.json(risk, { status: 201 });
  } catch (error) {
    console.error("Risks POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
