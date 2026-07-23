import { NextRequest } from "next/server";
import { AuditRepository } from "@/server/audit/audit.repository";
import { errorResponse, requireActor } from "@/server/http/route";
import { BudgetRepository } from "@/server/modules/budget/budget.repository";
import { BudgetService } from "@/server/modules/budget/budget.service";
const service = new BudgetService(new BudgetRepository(), new AuditRepository());
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; return Response.json(await service.activate(await requireActor(), id)); } catch (error) { return errorResponse(error); } }
