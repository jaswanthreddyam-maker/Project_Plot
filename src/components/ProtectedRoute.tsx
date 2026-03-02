"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const [isChecking, setIsChecking] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const token = localStorage.getItem("plot_auth_token");

        if (!token) {
            console.warn("[Protected Route] No token found, redirecting to login...");
            window.location.href = "/login";
        } else {
            setIsChecking(false);
        }
    }, [router]);

    if (isChecking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-4">
                    <svg className="w-8 h-8 text-black animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="text-sm text-gray-500 font-medium">Verifying access...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
