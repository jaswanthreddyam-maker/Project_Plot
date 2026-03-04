import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const proxy = auth((request) => {
    const { pathname } = request.nextUrl;
    const isLoggedIn = !!request.auth?.user;

    const isLogin = pathname === "/login" || pathname === "/";
    const isWorkspace = pathname.startsWith("/workspace");
    const isAutonomous = pathname.startsWith("/autonomous");
    const isProtectedAppRoute = isWorkspace || isAutonomous;

    if (isLogin && isLoggedIn) {
        return NextResponse.redirect(new URL("/workspace", request.url));
    }

    if (isProtectedAppRoute && !isLoggedIn) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
});

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
