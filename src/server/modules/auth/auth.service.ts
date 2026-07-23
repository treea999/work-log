import { toActor } from "@/server/auth/authorization";
import type { AuthRepositoryPort, AuthenticatedUser } from "./auth.types";

export class AuthService {
  constructor(private readonly repository: AuthRepositoryPort, private readonly verifyPassword: (plain: string, hash: string) => Promise<boolean>) {}
  async login(input: { name: string; password: string }): Promise<AuthenticatedUser | null> {
    const user = await this.repository.findByName(input.name);
    if (!user || !(await this.verifyPassword(input.password, user.password))) return null;
    const actor = toActor(user);
    if (!actor) return null;
    return { id: user.id, name: user.name, email: user.email, department: user.department, role: user.role, domainRole: actor.role };
  }
}
