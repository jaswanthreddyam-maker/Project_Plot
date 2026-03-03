/**
 * ════════════════════════════════════════════════════════════════
 * App Providers — Theme + Auth Guard (localStorage JWT)
 * ════════════════════════════════════════════════════════════════
 */
/**
 * App Providers — Theme + Auth Guard (Session Check)
 */
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ReactNode, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { SessionProvider, useSession } from "next-auth/react";
import { initializeApiInterceptors } from "@/lib/api";
import GlobalToaster from "@/components/layout/GlobalToaster";

function AuthGuard({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { status } = useSession();

    useEffect(() => {
        if (status === "loading") return;

        const isLogin = pathname === "/login" || pathname === "/";
        const isWorkspace = pathname.startsWith("/workspace");

        if (isWorkspace && status === "unauthenticated") {
            router.replace("/login");
        } else if (isLogin && status === "authenticated") {
            router.replace("/workspace");
        }
    }, [pathname, router, status]);

    return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
    useEffect(() => {
        initializeApiInterceptors();
    }, []);

    return (
        <SessionProvider>
            <NextThemesProvider attribute="class" defaultTheme="system" enableSystem={true}>
                {/* 🚀 FIX: AuthGuard inside SessionProvider to access session state */}
                <AuthGuard>{children}</AuthGuard>
                <GlobalToaster />
            </NextThemesProvider>
        </SessionProvider>
    );
}