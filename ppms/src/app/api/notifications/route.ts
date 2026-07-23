import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const where: any = { userId: user.id };
    if (unreadOnly) where.read = false;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200),
    });

    return Response.json(notifications);
  } catch (error) {
    console.error("Notifications GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    if (body.markAll) {
      await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
      return Response.json({ success: true });
    }

    if (body.ids && Array.isArray(body.ids)) {
      await prisma.notification.updateMany({
        where: { id: { in: body.ids }, userId: user.id },
        data: { read: true },
      });
      return Response.json({ success: true });
    }

    return Response.json({ error: "Invalid request body" }, { status: 400 });
  } catch (error) {
    console.error("Notifications PATCH error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
