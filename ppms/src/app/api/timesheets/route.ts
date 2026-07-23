import { NextRequest } from "next/server";
import { createTimesheetSchema } from "@/contracts/timesheet.schema";
import { AuditRepository } from "@/server/audit/audit.repository";
import { errorResponse, requireActor } from "@/server/http/route";
import { TimesheetRepository } from "@/server/modules/timesheet/timesheet.repository";
import { TimesheetService } from "@/server/modules/timesheet/timesheet.service";

const service = new TimesheetService(new TimesheetRepository(), new AuditRepository());
export async function GET() { try { return Response.json(await service.list(await requireActor())); } catch (error) { return errorResponse(error); } }
export async function POST(request: NextRequest) { try { const input = createTimesheetSchema.parse(await request.json()); return Response.json(await service.create(await requireActor(), input), { status: 201 }); } catch (error) { return errorResponse(error); } }
