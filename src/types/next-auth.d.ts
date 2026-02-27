/**
 * TypeScript type augmentation for NextAuth JWT and Session.
 * Adds the custom fields used by the vault unlock mechanism.
 */

import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            name?: string | null;
            email?: string | null;
        };
        isUnlocked: boolean;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        userId?: string;
        unlockFragment?: string;
        unlockedAt?: number;
    }
}
