import { NextRequest } from "next/server";
import { updateBudgetSchema } from "@/contracts/budget.schema";
import { AuditRepository } from "@/server/audit/audit.repository";
import { errorResponse, requireActor } from "@/server/http/route";
import { BudgetRepository } from "@/server/modules/budget/budget.repository";
import { BudgetService } from "@/server/modules/budget/budget.service";
const service = new BudgetService(new BudgetRepository(), new AuditRepository());
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; const input = updateBudgetSchema.parse(await request.json()); return Response.json(await service.update(await requireActor(), id, input)); } catch (error) { return errorResponse(error); } }
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; await service.delete(await requireActor(), id); return Response.json({ success: true }); } catch (error) { return errorResponse(error); } }
