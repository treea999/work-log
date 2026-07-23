import { NextRequest } from "next/server";
import { transitionTimesheetSchema } from "@/contracts/timesheet.schema";
import { AuditRepository } from "@/server/audit/audit.repository";
import { errorResponse, requireActor } from "@/server/http/route";
import { TimesheetRepository } from "@/server/modules/timesheet/timesheet.repository";
import { TimesheetService } from "@/server/modules/timesheet/timesheet.service";
const service = new TimesheetService(new TimesheetRepository(), new AuditRepository());
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const { reason } = transitionTimesheetSchema.parse(await request.json()); const { id } = await params; return Response.json(await service.reject(await requireActor(), id, reason!)); } catch (error) { return errorResponse(error); } }
