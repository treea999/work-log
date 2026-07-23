import { ZodError } from "zod";
import { getAuthUser } from "@/lib/auth-server";
import { AuthorizationError, toActor } from "@/server/auth/authorization";

export async function requireActor() {
  const actor = toActor(await getAuthUser());
  if (!actor) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  return actor;
}

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: "Validation failed", details: error.flatten() }, { status: 422 });
  if (error instanceof AuthorizationError) return Response.json({ error: error.message }, { status: 403 });
  if (error instanceof Error && "status" in error && typeof error.status === "number") return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error && /not found/i.test(error.message)) return Response.json({ error: error.message }, { status: 404 });
  if (error instanceof Error && /cannot transition|only draft|rejection reason/i.test(error.message)) return Response.json({ error: error.message }, { status: 409 });
  console.error(error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
