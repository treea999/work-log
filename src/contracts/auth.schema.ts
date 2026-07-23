import { z } from "zod";

export const actorRoleSchema = z.enum(["employee", "manager", "hr", "finance", "admin"]);
export type ActorRole = z.infer<typeof actorRoleSchema>;

export const loginSchema = z.object({
  name: z.string().min(1).max(100),
  password: z.string().min(1).max(256),
});
