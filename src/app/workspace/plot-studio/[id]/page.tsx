import PlotStudioEditor from "@/components/plot-studio/PlotStudioEditor";

interface PlotStudioProjectPageProps {
    params: Promise<{ id: string }>;
}

export default async function PlotStudioProjectPage({ params }: PlotStudioProjectPageProps) {
    const { id } = await params;
    return <PlotStudioEditor projectId={id} />;
}
