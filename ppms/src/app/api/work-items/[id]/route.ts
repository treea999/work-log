import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-server";

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
      if (key === "id" || key === "projectId") continue;
      data[key] = dateFields.includes(key) && value ? new Date(value as string) : value;
    }

    const workItem = await prisma.workItem.update({
      where: { id },
      data,
      include: {
        project: { select: { id: true, code: true, name: true } },
      },
    });

    return Response.json(workItem);
  } catch (error) {
    console.error("WorkItem PATCH error:", error);
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
    await prisma.workItem.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (error) {
    console.error("WorkItem DELETE error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
