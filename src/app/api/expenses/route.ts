import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-server";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const projectId = searchParams.get("projectId");

    const where: any = {};
    if (projectId) where.projectId = projectId;

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        project: { select: { id: true, code: true, name: true } },
        requester: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(expenses);
  } catch (error) {
    console.error("Expenses GET error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const amountExclTax = body.amountExclTax || 0;
    const tax = body.tax || 0;
    const expense = await prisma.expense.create({
      data: {
        projectId: body.projectId,
        category: body.category,
        date: body.date ? new Date(body.date) : new Date(),
        type: body.type,
        vendor: body.vendor,
        description: body.description,
        amountExclTax,
        tax,
        amountInclTax: body.amountInclTax || amountExclTax + tax,
        invoiceNo: body.invoiceNo,
        poNo: body.poNo,
        requesterId: user.id,
        approvalStatus: "Pending",
        paymentStatus: "Unpaid",
        attachments: body.attachments || [],
      },
      include: {
        project: { select: { id: true, code: true, name: true } },
        requester: { select: { id: true, name: true } },
      },
    });

    return Response.json(expense, { status: 201 });
  } catch (error) {
    console.error("Expenses POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
