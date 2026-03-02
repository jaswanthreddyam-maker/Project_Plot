import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const googleClientId = process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

if (!googleClientId || !googleClientSecret) {
    throw new Error("Missing Google OAuth env vars (AUTH_GOOGLE_ID/SECRET or GOOGLE_CLIENT_ID/SECRET).");
}

if (!authSecret) {
    throw new Error("Missing auth secret env var (AUTH_SECRET or NEXTAUTH_SECRET).");
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
