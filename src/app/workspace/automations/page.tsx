"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, ChevronRight, MoreVertical, Search } from "lucide-react";
import { API_BASE, fetchWithTimeout, readErrorMessage } from "@/lib/api";
import { showToast } from "@/lib/toast";
import type { ProjectDto } from "@/types/api";

const SUGGESTIONS = [
    "Score leads",
    "Summarize support tickets",
    "Route webhook events",
    "Generate weekly ops report",
];

function inferProjectTitle(prompt: string): string {
    const cleaned = prompt.trim().replace(/\s+/g, " ");
    if (!cleaned) return "Untitled Project";
    const words = cleaned.split(" ").slice(0, 6).join(" ");
    return words.length > 0 ? words : "Untitled Project";
}

function formatProjectAge(updatedAt: string): string {
    const parsedIso = parseISO(updatedAt);
    if (isValid(parsedIso)) {
        return formatDistanceToNowStrict(parsedIso, { addSuffix: true });
    }

    const parsedNative = new Date(updatedAt);
    if (isValid(parsedNative)) {
        return formatDistanceToNowStrict(parsedNative, { addSuffix: true });
    }

    return updatedAt;
}

export default function AutomationsPage() {
    const router = useRouter();
    const [prompt, setPrompt] = useState("");
    const [search, setSearch] = useState("");
    const [projects, setProjects] = useState<ProjectDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadProjects = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetchWithTimeout(`${API_BASE}/api/projects/`, { timeout: 12000 });
                if (!res.ok) {
                    const detail = await readErrorMessage(
                        res,
                        `Failed to fetch projects (HTTP ${res.status})`
                    );
                    throw new Error(detail);
                }
                const data = (await res.json()) as ProjectDto[];
                if (cancelled) return;
                setProjects(Array.isArray(data) ? data : []);
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : "Failed to fetch projects.");
                setProjects([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void loadProjects();
        return () => {
            cancelled = true;
        };
    }, []);

    const filteredProjects = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return projects;
        return projects.filter((project) => {
            const title = project.title.toLowerCase();
            const description = (project.description || "").toLowerCase();
            return title.includes(query) || description.includes(query);
        });
    }, [projects, search]);

    const createProject = async (promptInput: string) => {
        if (creating) return;
        setCreating(true);
        setError(null);

        try {
            const body = {
                title: inferProjectTitle(promptInput),
                prompt: promptInput,
            };

            const res = await fetchWithTimeout(`${API_BASE}/api/projects/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                timeout: 12000,
            });
            if (!res.ok) {
                const detail = await readErrorMessage(
                    res,
                    `Failed to create project (HTTP ${res.status})`
                );
                throw new Error(detail);
            }

            const created = (await res.json()) as ProjectDto;
            setProjects((current) => [created, ...current.filter((project) => project.id !== created.id)]);
            setPrompt("");
            router.push(`/workspace/plot-studio/${created.id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create project.");
        } finally {
            setCreating(false);
        }
    };

    const handleGeneratorSubmit = async (event: FormEvent) => {
        event.preventDefault();
        await createProject(prompt.trim());
    };

    return (
        <div className="h-full overflow-y-auto bg-white text-black dark:bg-[#131314] dark:text-[#e3e3e3]">
            <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-[#333639] dark:bg-[#131314]/95">
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-[#c4c7c5] dark:hover:text-[#e3e3e3]"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to Chat
                        </Link>
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500 dark:text-[#c4c7c5]">Workspace</p>
                            <h1 className="text-lg font-semibold">PlotAI Workspace</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="hidden items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-[#333639] dark:bg-[#1e1f22] md:flex">
                            <Search size={14} className="text-gray-500 dark:text-[#c4c7c5]" />
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search projects"
                                className="w-44 bg-transparent text-sm outline-none placeholder:text-gray-500 dark:placeholder:text-[#c4c7c5]"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => showToast("No notifications right now.", "info")}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white hover:bg-gray-100 dark:border-[#333639] dark:bg-[#1e1f22] dark:hover:bg-[#282a2c]"
                            title="Notifications"
                        >
                            <Bell size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push("/workspace")}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-black text-sm font-semibold text-white dark:border dark:border-[#333639] dark:bg-[#1e1f22] dark:text-[#e3e3e3] dark:hover:bg-[#282a2c]"
                            title="Profile"
                        >
                            PA
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto w-full max-w-7xl px-6 py-8 space-y-8">
                <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-[#333639] dark:bg-[#1e1f22]">
                    <form onSubmit={handleGeneratorSubmit} className="space-y-4">
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#333639] dark:bg-[#1e1f22]">
                            <textarea
                                value={prompt}
                                onChange={(event) => setPrompt(event.target.value)}
                                placeholder="Describe the automation you want to build..."
                                className="h-40 w-full resize-none border-0 bg-transparent text-sm text-black placeholder:text-gray-500 outline-none dark:text-[#e3e3e3] dark:placeholder:text-[#c4c7c5]"
                            />
                            <div className="mt-3 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="inline-flex h-9 items-center gap-1 rounded-lg bg-black px-3 text-sm font-medium text-white disabled:opacity-60"
                                >
                                    Generate
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {SUGGESTIONS.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() => setPrompt(suggestion)}
                                    className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-[#333639] dark:bg-[#1e1f22] dark:hover:bg-[#282a2c]"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </form>
                </section>

                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">Recent Projects</h2>
                        <p className="text-sm text-gray-600 dark:text-[#c4c7c5]">{filteredProjects.length} results</p>
                    </div>

                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {Array.from({ length: 8 }).map((_, index) => (
                                <div key={index} className="h-[220px] animate-pulse rounded-xl border border-gray-200 bg-white p-4 dark:border-[#333639] dark:bg-[#1e1f22]" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <button
                                type="button"
                                onClick={() => void createProject("")}
                                disabled={creating}
                                className="h-[220px] rounded-xl border-2 border-dashed border-gray-400 bg-white p-6 text-left hover:bg-gray-50 disabled:opacity-60 dark:border-[#333639] dark:bg-[#1e1f22] dark:hover:bg-[#282a2c]"
                            >
                                <div className="flex h-full flex-col justify-between">
                                    <span className="text-4xl leading-none text-black dark:text-[#e3e3e3]">+</span>
                                    <div>
                                        <p className="text-base font-semibold">Create New</p>
                                        <p className="text-sm text-gray-600 dark:text-[#c4c7c5]">Start fresh project</p>
                                    </div>
                                </div>
                            </button>

                            {filteredProjects.map((project) => (
                                <article
                                    key={project.id}
                                    onClick={() => router.push(`/workspace/plot-studio/${project.id}`)}
                                    className="h-[220px] cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 dark:border-[#333639] dark:bg-[#1e1f22] dark:hover:border-[#333639] dark:hover:bg-[#282a2c]"
                                >
                                    <div className="flex h-full flex-col justify-between">
                                        <div className="space-y-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <h3 className="line-clamp-2 text-base font-semibold">{project.title}</h3>
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        router.push(`/workspace/plot-studio/${project.id}`);
                                                    }}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 bg-white hover:bg-gray-100 dark:border-[#333639] dark:bg-[#1e1f22] dark:hover:bg-[#282a2c]"
                                                    title="Open project"
                                                >
                                                    <MoreVertical size={14} />
                                                </button>
                                            </div>
                                            <p className="line-clamp-3 text-sm text-gray-600 dark:text-[#c4c7c5]">
                                                {project.description || "Start fresh project"}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-gray-500 dark:text-[#c4c7c5]">
                                                {formatProjectAge(project.updated_at)}
                                            </p>
                                            <Link
                                                href={`/workspace/plot-studio/${project.id}`}
                                                onClick={(event) => event.stopPropagation()}
                                                className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:border-[#333639] dark:hover:bg-[#282a2c]"
                                            >
                                                Edit &gt;
                                            </Link>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
