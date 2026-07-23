import type { ActorRole } from "@/contracts/auth.schema";
export type AuthenticatedUser = { id: string; name: string; email: string; department: string; role: string; domainRole: ActorRole };
export interface AuthRepositoryPort { findByName(name: string): Promise<{ id: string; name: string; email: string; department: string; role: string; password: string } | null>; }
