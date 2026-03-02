import PlotStudioEditorClient from "@/components/plot-studio/PlotStudioEditorClient";

interface PlotStudioProjectPageProps {
    params: { id: string };
}

export default function PlotStudioProjectPage({ params }: PlotStudioProjectPageProps) {
    const { id } = params;
    return <PlotStudioEditorClient projectId={id} />;
}
