/**
 * ════════════════════════════════════════════════════════════════
 * NextAuth v5 Configuration — Credentials + Google OAuth
 * ════════════════════════════════════════════════════════════════
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { PrismaAdapter } from "@auth/prisma-adapter";

// ─── Unlock Expiry (30 minutes in milliseconds) ─────────────
const UNLOCK_EXPIRY_MS = 30 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma),

    session: {
        strategy: "jwt",
        maxAge: 24 * 60 * 60, // 24 hours
    },

    pages: {
        signIn: "/login",
    },

    providers: [
        // ── Credentials (email + password) ───────────────────
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },

            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                const email =
                    typeof credentials.email === "string"
                        ? credentials.email.trim().toLowerCase()
                        : "";
                if (!email) return null;

                const user = await prisma.user.findUnique({
                    where: { email },
                });

                if (!user || !user.passwordHash) return null;

                const isValid = await bcrypt.compare(
                    credentials.password as string,
                    user.passwordHash
                );

                if (!isValid) return null;

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                };
            },
        }),

        // ── Google OAuth (only if credentials are configured) ──
        ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
            ? [Google({
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                allowDangerousEmailAccountLinking: true,
                authorization: {
                    params: {
                        prompt: "select_account",
                        access_type: "offline",
                    },
                },
            })]
            : []),
    ],

    callbacks: {
        /**
         * signIn — allow all OAuth sign-ins, block failed credentials.
         */
        async signIn({ user, account }) {
            // OAuth users are always allowed (adapter creates them)
            if (account?.provider !== "credentials") return true;
            // Credentials: only allow if user was returned by authorize()
            return !!user;
        },

        /**
         * redirect — ensure we always go to /workspace after sign-in.
         */
        async redirect({ url, baseUrl }) {
            // If the url is relative, prepend the base URL
            if (url.startsWith("/")) return `${baseUrl}${url}`;
            // If same origin, allow it
            if (new URL(url).origin === baseUrl) return url;
            // Default: workspace
            return `${baseUrl}/workspace`;
        },

        /**
         * JWT callback — runs on every token creation and refresh.
         */
        async jwt({ token, user, trigger, session, account }) {
            // On initial sign-in, attach user ID and image
            if (user) {
                token.userId = user.id;
                token.picture = user.image;
            }

            // For OAuth: if userId is missing, look it up by email
            if (!token.userId && token.email) {
                const normalizedEmail =
                    typeof token.email === "string"
                        ? token.email.trim().toLowerCase()
                        : "";
                if (normalizedEmail) {
                    const dbUser = await prisma.user.findUnique({
                        where: { email: normalizedEmail },
                        select: { id: true, image: true },
                    });
                    if (dbUser) {
                        token.userId = dbUser.id;
                        token.picture = dbUser.image;
                    }
                }
            }

            // If signing in with OAuth, record the provider
            if (account) {
                token.provider = account.provider;
            }

            // ── Vault Unlock Trigger ─────────────────────────────
            if (trigger === "update" && session?.unlockFragment) {
                token.unlockFragment = session.unlockFragment;
                token.unlockedAt = Date.now();
            }

            // ── Sliding Expiration Check ─────────────────────────
            if (token.unlockedAt && typeof token.unlockedAt === "number") {
                if (Date.now() - token.unlockedAt > UNLOCK_EXPIRY_MS) {
                    delete token.unlockFragment;
                    delete token.unlockedAt;
                }
            }

            return token;
        },

        /**
         * Session callback — shapes what the client sees.
         */
        async session({ session, token }) {
            if (session.user) {
                (session.user as { id?: string }).id = token.userId as string;
                (session.user as { image?: string | null }).image = token.picture as string || null;
            }
            (session as { isUnlocked?: boolean }).isUnlocked =
                !!token.unlockFragment;
            return session;
        },

        /**
         * authorized — middleware gate for route protection.
         */
        authorized({ auth: session, request: { nextUrl } }) {
            const isLoggedIn = !!session?.user;
            const isWorkspace = nextUrl.pathname.startsWith("/workspace");
            const isLogin = nextUrl.pathname === "/login";

            // Protect workspace — redirect to login if not authenticated
            if (isWorkspace && !isLoggedIn) {
                return Response.redirect(new URL("/login", nextUrl));
            }

            // Already logged in — redirect away from login page
            if (isLogin && isLoggedIn) {
                return Response.redirect(new URL("/workspace", nextUrl));
            }

            return true;
        },
    },

    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
});
