import type { AmpRoute } from "@/store/uiStore";

export const AMP_ROUTE_PATHS: Record<AmpRoute, string> = {
    "automations": "/workspace/automations",
    "crew-studio": "/workspace/plot-studio",
    "templates": "/workspace/templates",
    "agents-repository": "/workspace/agents-repository",
    "tools-integrations": "/workspace/tools-integrations",
    "traces": "/workspace/traces",
    "llm-connections": "/workspace/llm-connections",
    "environment-variables": "/workspace/environment-variables",
    "usage": "/workspace/usage",
    "billing": "/workspace/billing",
    "settings": "/workspace/settings",
};

const PATH_SEGMENT_TO_AMP_ROUTE: Record<string, AmpRoute> = {
    "automations": "automations",
    "plot-studio": "crew-studio",
    "templates": "templates",
    "agents-repository": "agents-repository",
    "tools-integrations": "tools-integrations",
    "traces": "traces",
    "llm-connections": "llm-connections",
    "environment-variables": "environment-variables",
    "usage": "usage",
    "billing": "billing",
    "settings": "settings",
};

export function ampRouteFromPathname(pathname: string): AmpRoute | null {
    if (!pathname.startsWith("/workspace")) return null;
    if (pathname === "/workspace") return "crew-studio";

    const segment = pathname.split("/").filter(Boolean)[1];
    if (!segment) return "crew-studio";
    return PATH_SEGMENT_TO_AMP_ROUTE[segment] || null;
}

export function isWorkspaceSubRoute(pathname: string): boolean {
    return pathname.startsWith("/workspace/") && pathname !== "/workspace";
}
