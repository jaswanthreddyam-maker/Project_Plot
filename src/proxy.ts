import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
    const session = await auth();
    const { pathname } = request.nextUrl;
    const isLoggedIn = !!session?.user;

    const isLogin = pathname === "/login" || pathname === "/";
    const isWorkspace = pathname.startsWith("/workspace");

    if (isLogin && isLoggedIn) {
        return NextResponse.redirect(new URL("/workspace", request.url));
    }

    if (isWorkspace && !isLoggedIn) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
