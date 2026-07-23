import { NextRequest } from "next/server";
import { AuditRepository } from "@/server/audit/audit.repository";
import { errorResponse, requireActor } from "@/server/http/route";
import { TimesheetRepository } from "@/server/modules/timesheet/timesheet.repository";
import { TimesheetService } from "@/server/modules/timesheet/timesheet.service";
const service = new TimesheetService(new TimesheetRepository(), new AuditRepository());
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; return Response.json(await service.submit(await requireActor(), id)); } catch (error) { return errorResponse(error); } }
