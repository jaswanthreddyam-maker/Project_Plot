/**
 * Proxy is intentionally disabled for app-page auth redirects.
 *
 * This project currently uses a FastAPI JWT stored in localStorage
 * (`plot_auth_token`) for `/workspace` gating on the client. Server-side
 * middleware cannot read localStorage, which caused redirect loops:
 * `/login` -> `/workspace` (client guard) and `/workspace` -> `/login`
 * (server proxy).
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(_request: NextRequest) {
    return NextResponse.next();
}

export const config = {
    matcher: ["/__proxy_disabled__/:path*"],
};
