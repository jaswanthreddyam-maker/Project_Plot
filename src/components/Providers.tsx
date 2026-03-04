"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ReactNode, useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import { initializeApiInterceptors } from "@/lib/api";
import GlobalToaster from "@/components/layout/GlobalToaster";
import { BackendTokenSync } from "@/components/auth/BackendTokenSync";

export function Providers({ children }: { children: ReactNode }) {
    useEffect(() => {
        initializeApiInterceptors();
    }, []);

    return (
        <SessionProvider>
            <BackendTokenSync />
            <NextThemesProvider attribute="class" defaultTheme="system" enableSystem={true}>
                {children}
                <GlobalToaster />
            </NextThemesProvider>
        </SessionProvider>
    );
}
