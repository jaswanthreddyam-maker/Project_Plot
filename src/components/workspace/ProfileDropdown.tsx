/**
 * ════════════════════════════════════════════════════════════════
 * ProfileDropdown — Shows user avatar with Logout/Switch Account
 * ════════════════════════════════════════════════════════════════
 */
"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

export default function ProfileDropdown() {
    const { data: session } = useSession();
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    if (!session?.user) return null;

    const user = session.user;
    const initials = (user.name || user.email || "U")
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    const handleLogout = async () => {
        setOpen(false);
        await signOut({ callbackUrl: "/login" });
    };

    const handleSwitchAccount = () => {
        setOpen(false);
        // Open Google account picker directly — no sign-out needed
        signIn("google", { callbackUrl: "/workspace" });
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Avatar button */}
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 rounded-full hover:ring-2 hover:ring-gray-200 transition-all"
            >
                {(user as { image?: string }).image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={(user as { image?: string }).image!}
                        alt={user.name || "Profile"}
                        className="w-8 h-8 rounded-full object-cover border border-gray-200"
                    />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-bold">
                        {initials}
                    </div>
                )}
            </button>

            {/* Dropdown menu */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900 truncate">
                            {user.name || "User"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                            {user.email}
                        </p>
                    </div>

                    {/* Menu items */}
                    <button
                        onClick={handleSwitchAccount}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                            <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                            <circle cx="8.5" cy="7" r="4" />
                            <path d="M20 8v6M23 11h-6" />
                        </svg>
                        Switch Account
                    </button>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400">
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        Logout
                    </button>
                </div>
            )}
        </div>
    );
}
