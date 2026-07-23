import { NextRequest } from "next/server";
import { createBudgetSchema } from "@/contracts/budget.schema";
import { AuditRepository } from "@/server/audit/audit.repository";
import { errorResponse, requireActor } from "@/server/http/route";
import { BudgetRepository } from "@/server/modules/budget/budget.repository";
import { BudgetService } from "@/server/modules/budget/budget.service";
const service = new BudgetService(new BudgetRepository(), new AuditRepository());
export async function GET(request: NextRequest) { try { return Response.json(await service.list(request.nextUrl.searchParams.get("projectId") ?? undefined)); } catch (error) { return errorResponse(error); } }
export async function POST(request: NextRequest) { try { const input = createBudgetSchema.parse(await request.json()); return Response.json(await service.create(await requireActor(), input), { status: 201 }); } catch (error) { return errorResponse(error); } }
