// Singleton do Prisma Client.
// Antes cada rota fazia `new PrismaClient()`, o que esgota conexões
// no dev (hot-reload) e em serverless. O contrato da API não muda:
// apenas reutiliza a mesma instância.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
