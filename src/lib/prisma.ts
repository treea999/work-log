import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const databaseUrl = process.env.DATABASE_URL;

function isPlaceholderDatabase(url: string | undefined) {
  return !url || url.includes("johndoe") || url.includes("localhost:5432/mydb");
}

function buildMock(): PrismaClient {
  const operationHandler: ProxyHandler<object> = {
    get(_, method: string) {
      if (["findMany", "groupBy"].includes(method)) return () => Promise.resolve([]);
      if (["findUnique", "findFirst"].includes(method)) return () => Promise.resolve(null);
      if (method === "count") return () => Promise.resolve(0);
      if (method === "aggregate") return () => Promise.resolve({});
      if (["create", "update", "delete", "upsert", "updateMany", "deleteMany"].includes(method)) {
        return () => Promise.resolve({});
      }
      return () => Promise.resolve(null);
    },
  };
  const modelHandler: ProxyHandler<object> = {
    get(_, property) {
      if (typeof property === "string" && property.startsWith("$")) return () => null;
      return new Proxy({}, operationHandler);
    },
  };
  return new Proxy({}, modelHandler) as PrismaClient;
}

function buildClient(url: string): PrismaClient {
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

function createPrismaClient() {
  if (isPlaceholderDatabase(databaseUrl)) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL must reference a production PostgreSQL database");
    }
    return buildMock();
  }

  const configuredDatabaseUrl = databaseUrl as string;
  return globalForPrisma.prisma ?? buildClient(configuredDatabaseUrl);
}

export const prisma = createPrismaClient();
