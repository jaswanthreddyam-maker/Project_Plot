/**
 * ════════════════════════════════════════════════════════════════
 * Prisma Client Singleton
 * ════════════════════════════════════════════════════════════════
 * Prevents multiple Prisma Client instances during hot reloads
 * in Next.js development mode.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

export default prisma;
