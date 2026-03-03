import type { NextAuthConfig } from "next-auth";

export const authConfig = {
    trustHost: true,
    pages: {
        signIn: "/login",
    },
    providers: [],
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnWorkspace = nextUrl.pathname.startsWith("/workspace");
            const isOnLogin = nextUrl.pathname === "/login" || nextUrl.pathname === "/";

            if (isOnWorkspace) {
                if (isLoggedIn) return true;
                return false; // Redirects to login
            } else if (isOnLogin) {
                if (isLoggedIn) {
                    return Response.redirect(new URL("/workspace", nextUrl));
                }
                return true;
            }
            return true;
        },
    },
} satisfies NextAuthConfig;
