import { NextRequest } from "next/server";
import { updateTimesheetSchema } from "@/contracts/timesheet.schema";
import { AuditRepository } from "@/server/audit/audit.repository";
import { errorResponse, requireActor } from "@/server/http/route";
import { TimesheetRepository } from "@/server/modules/timesheet/timesheet.repository";
import { TimesheetService } from "@/server/modules/timesheet/timesheet.service";
const service = new TimesheetService(new TimesheetRepository(), new AuditRepository());
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const input = updateTimesheetSchema.parse(await request.json()); const { id } = await params; return Response.json(await service.update(await requireActor(), id, input)); } catch (error) { return errorResponse(error); } }
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) { try { const { id } = await params; await service.delete(await requireActor(), id); return Response.json({ success: true }); } catch (error) { return errorResponse(error); } }
