/**
 * Auth Proxy - route protection for Plot.
 *
 * - Unauthenticated users visiting /workspace -> redirect to /login
 * - Authenticated users visiting /login -> redirect to /workspace
 */

export { auth as proxy } from "@/lib/auth";

export const config = {
    matcher: ["/workspace/:path*", "/login"],
};

