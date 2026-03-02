/**
 * ════════════════════════════════════════════════════════════════
 * App Providers — Theme + Auth Guard (localStorage JWT)
 * ════════════════════════════════════════════════════════════════
 */
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { initializeApiInterceptors } from "@/lib/api";

function AuthGuard({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const token = localStorage.getItem("plot_auth_token");
        const isLogin = pathname === "/login" || pathname === "/";
        const isWorkspace = pathname.startsWith("/workspace");

        if (isWorkspace && !token) {
            console.log("[AuthGuard] No token. Redirecting to /login");
            router.push("/login");
        } else if (isLogin && token) {
            console.log("[AuthGuard] Token found. Redirecting to /workspace");
            router.push("/workspace");
        }
    }, [pathname, router]);

    return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
    useEffect(() => {
        initializeApiInterceptors();
    }, []);

    return (
        <NextThemesProvider attribute="class" defaultTheme="system" enableSystem={true}>
            <AuthGuard>{children}</AuthGuard>
        </NextThemesProvider>
    );
}
