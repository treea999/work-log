import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be configured`);
  return value;
}

async function main() {
  const databaseUrl = requiredEnvironment("DATABASE_URL");
  const name = requiredEnvironment("ADMIN_NAME");
  const email = requiredEnvironment("ADMIN_EMAIL");
  const password = requiredEnvironment("ADMIN_PASSWORD");
  const department = process.env.ADMIN_DEPARTMENT || "PMO";

  if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.upsert({
      where: { email },
      update: { name, password: passwordHash, role: "Admin", department },
      create: { name, email, password: passwordHash, role: "Admin", department },
    });
    console.log(`Administrator ${email} is ready.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
