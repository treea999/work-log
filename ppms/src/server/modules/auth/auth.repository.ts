import { prisma } from "@/lib/prisma";
import type { AuthRepositoryPort } from "./auth.types";
export class AuthRepository implements AuthRepositoryPort { findByName(name: string) { return prisma.user.findUnique({ where: { name } }); } }
