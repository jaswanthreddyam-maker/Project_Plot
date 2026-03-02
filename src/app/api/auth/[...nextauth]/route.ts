import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

function normalizeEnvValue(value?: string): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (
        (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.slice(1, -1).trim() || undefined;
    }
    return trimmed;
}

const googleClientId = normalizeEnvValue(
    process.env.AUTH_GOOGLE_ID ??
    process.env.GOOGLE_CLIENT_ID ??
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
);
const googleClientSecret = normalizeEnvValue(
    process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET
);
const authSecret = normalizeEnvValue(
    process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
);

if (!googleClientId || !googleClientSecret) {
    console.error("[Auth Config] Missing Google provider vars", {
        hasAuthGoogleId: Boolean(normalizeEnvValue(process.env.AUTH_GOOGLE_ID)),
        hasGoogleClientId: Boolean(normalizeEnvValue(process.env.GOOGLE_CLIENT_ID)),
        hasNextPublicGoogleClientId: Boolean(normalizeEnvValue(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)),
        hasAuthGoogleSecret: Boolean(normalizeEnvValue(process.env.AUTH_GOOGLE_SECRET)),
        hasGoogleClientSecret: Boolean(normalizeEnvValue(process.env.GOOGLE_CLIENT_SECRET)),
    });
    throw new Error("Missing Google OAuth env vars.");
}

if (!authSecret) {
    console.error("[Auth Config] Missing auth secret var", {
        hasAuthSecret: Boolean(normalizeEnvValue(process.env.AUTH_SECRET)),
        hasNextAuthSecret: Boolean(normalizeEnvValue(process.env.NEXTAUTH_SECRET)),
    });
    throw new Error("Missing auth secret env var.");
}

const authOptions: NextAuthConfig = {
    secret: authSecret,
    trustHost: true,
    debug: process.env.NODE_ENV === "development",
    providers: [
        GoogleProvider({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
        }),
    ],
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
    callbacks: {
        async jwt({ token, account }) {
            if (account?.provider === "google" && account.access_token) {
                token.googleAccessToken = account.access_token;
            }
            return token;
        },
        async session({ session, token }) {
            session.googleAccessToken = token.googleAccessToken as string | undefined;
            return session;
        },
    },
};

const { handlers } = NextAuth(authOptions);
export const { GET, POST } = handlers;
