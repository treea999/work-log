import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth-server";
import { hasPermission } from "@/lib/auth";

const AUTH_PATH = "/api/auth";

function requiredPermission(request: NextRequest): string | null {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return request.nextUrl.pathname === "/api/users" ? "manage_users" : null;
  }

  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/projects")) {
    if (request.method === "POST") return "create_project";
    if (request.method === "DELETE") return "delete_project";
    return "edit_project";
  }
  if (path.startsWith("/api/work-items") || path.startsWith("/api/risks")) return "edit_project";
  if (path.startsWith("/api/expenses")) return request.method === "DELETE" ? "approve_all" : "create_expense";
  if (path.startsWith("/api/approvals")) return "approve_expense";
  return null;
}

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === AUTH_PATH) return NextResponse.next();

  const token = request.cookies.get("ppm_token")?.value;
  const actor = token ? verifyToken(token) : null;
  if (!actor) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const permission = requiredPermission(request);
  if (permission && !hasPermission(actor.role, permission)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/mywork/:path*",
    "/approvals/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/api/:path*",
  ],
};
