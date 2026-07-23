import { NextRequest } from "next/server";
import { loginSchema } from "@/contracts/auth.schema";
import { prisma } from "@/lib/prisma";
import { createToken, getAuthUser, verifyPassword } from "@/lib/auth-server";

function secureSuffix() {
  return process.env.NODE_ENV === "production" ? "; Secure" : "";
}

function sessionCookie(value: string, maxAge: number) {
  return `ppm_token=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureSuffix()}`;
}

const expiredSessionCookie = `ppm_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureSuffix()}`;
const suppressBypassCookie = `ppm_skip_bypass=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=60${secureSuffix()}`;

export async function GET() {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(user);
}

export async function POST(request: NextRequest) {
  try {
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== "object" || !("action" in payload)) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const { action } = payload as { action: unknown };
    if (action === "logout") {
      const response = Response.json({ success: true });
      response.headers.append("Set-Cookie", expiredSessionCookie);
      response.headers.append("Set-Cookie", suppressBypassCookie);
      return response;
    }

    if (action === "bypass") {
      const bypassEnabled = process.env.NODE_ENV !== "production"
        && process.env.AUTH_BYPASS_ENABLED === "true";
      if (!bypassEnabled || request.cookies.get("ppm_skip_bypass")) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }

      const databaseAdmin = await prisma.user.findFirst({
        where: { role: "Admin" },
        select: { id: true, name: true, email: true, role: true, department: true },
      });
      const user = databaseAdmin ?? {
        id: "development-bypass-admin",
        name: "Development Admin",
        email: "dev-admin@localhost",
        role: "Admin",
        department: "Development",
      };
      const token = createToken({ id: user.id, name: user.name, role: user.role });
      const response = Response.json(user);
      response.headers.set("Set-Cookie", sessionCookie(token, 86400));
      return response;
    }

    if (action === "seed") {
      if (process.env.NODE_ENV === "production") return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json({ error: "Use npm run db:seed" }, { status: 410 });
    }

    if (action !== "login") return Response.json({ error: "Unknown action" }, { status: 400 });

    const parsed = loginSchema.safeParse(payload);
    if (!parsed.success) {
      return Response.json({ error: "Invalid credentials", issues: parsed.error.flatten() }, { status: 422 });
    }

    const user = await prisma.user.findUnique({ where: { name: parsed.data.name } });
    if (!user || !(await verifyPassword(parsed.data.password, user.password))) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = createToken({ id: user.id, name: user.name, role: user.role });
    const response = Response.json({ id: user.id, name: user.name, email: user.email, role: user.role, department: user.department });
    response.headers.set("Set-Cookie", sessionCookie(token, 86400));
    return response;
  } catch (error) {
    console.error("Auth error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
