import { NextRequest } from "next/server";
import { transitionBudgetSchema } from "@/contracts/budget.schema";
import { AuditRepository } from "@/server/audit/audit.repository";
import { errorResponse, requireActor } from "@/server/http/route";
import { BudgetRepository } from "@/server/modules/budget/budget.repository";
import { BudgetService } from "@/server/modules/budget/budget.service";
const service = new BudgetService(new BudgetRepository(), new AuditRepository());
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; const { reason } = transitionBudgetSchema.parse(await request.json()); return Response.json(await service.reject(await requireActor(), id, reason!)); } catch (error) { return errorResponse(error); } }
