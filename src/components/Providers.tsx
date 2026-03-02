/**
 * ════════════════════════════════════════════════════════════════
 * App Providers — Theme + Auth Guard (localStorage JWT)
 * ════════════════════════════════════════════════════════════════
 */
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { initializeApiInterceptors } from "@/lib/api";
import GlobalToaster from "@/components/layout/GlobalToaster";

function AuthGuard({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const token = localStorage.getItem("plot_auth_token");
        const isLogin = pathname === "/login" || pathname === "/";
        const isWorkspace = pathname.startsWith("/workspace");

        if (isWorkspace && !token) {
            router.replace("/login");
        } else if (isLogin && token) {
            router.replace("/workspace");
        }
    }, [pathname, router]);

    return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
    useEffect(() => {
        initializeApiInterceptors();
    }, []);

    return (
        <SessionProvider>
            <NextThemesProvider attribute="class" defaultTheme="system" enableSystem={true}>
                <AuthGuard>{children}</AuthGuard>
                <GlobalToaster />
            </NextThemesProvider>
        </SessionProvider>
    );
}
