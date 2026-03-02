import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const nextAuthSecret = process.env.NEXTAUTH_SECRET;

if (!googleClientId) {
    throw new Error("Missing Google ID");
}

if (!googleClientSecret) {
    throw new Error("Missing Google Secret");
}

if (!nextAuthSecret) {
    throw new Error("Missing NextAuth Secret");
}

const authOptions: NextAuthConfig = {
    secret: nextAuthSecret,
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
