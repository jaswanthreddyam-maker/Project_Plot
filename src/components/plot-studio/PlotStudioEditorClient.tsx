"use client";

import dynamic from "next/dynamic";

interface PlotStudioEditorProps {
    projectId?: string;
}

const PlotStudioEditor = dynamic<PlotStudioEditorProps>(
    () => import("./PlotStudioEditor"),
    {
        ssr: false,
        loading: () => <div className="h-full w-full bg-white dark:bg-[#131314]" />,
    }
);

export default function PlotStudioEditorClient({ projectId }: PlotStudioEditorProps) {
    return <PlotStudioEditor projectId={projectId} />;
}
