"use client";

import dynamic from "next/dynamic";
import { useUIStore } from "@/store/uiStore";
import ToolExecutionStream from "@/components/tools/ToolExecutionStream";
import WorkspaceHeader from "@/components/layout/WorkspaceHeader";

const autonomousLoading = () => <div className="flex-1 bg-white dark:bg-[#171717]" />;

const CrewStudio = dynamic(() => import("@/components/autonomous/CrewStudio"), { loading: autonomousLoading });
const ToolsIntegrations = dynamic(() => import("@/components/autonomous/ToolsIntegrations"), { loading: autonomousLoading });
const Traces = dynamic(() => import("@/components/autonomous/Traces"), { loading: autonomousLoading });
const Automations = dynamic(() => import("@/components/autonomous/Automations"), { loading: autonomousLoading });
const LLMConnections = dynamic(() => import("@/components/autonomous/LLMConnections"), { loading: autonomousLoading });
const EnvVariables = dynamic(() => import("@/components/autonomous/EnvVariables"), { loading: autonomousLoading });
const Settings = dynamic(() => import("@/components/autonomous/Settings"), { loading: autonomousLoading });
const Templates = dynamic(() => import("@/components/autonomous/Templates"), { loading: autonomousLoading });
const AgentsRepository = dynamic(() => import("@/components/autonomous/AgentsRepository"), { loading: autonomousLoading });
const UsagePage = dynamic(
    () => import("@/components/autonomous/Usage").then((mod) => mod.UsagePage),
    { loading: autonomousLoading }
);
const BillingPage = dynamic(
    () => import("@/components/autonomous/Billing").then((mod) => mod.BillingPage),
    { loading: autonomousLoading }
);

export default function AutonomousPage() {
    const activeAmpRoute = useUIStore((s) => s.activeAmpRoute);

    const renderAutonomousRoute = () => {
        switch (activeAmpRoute) {
            case "agents-repository":
                return <AgentsRepository />;
            case "templates":
                return <Templates />;
            case "llm-connections":
                return <LLMConnections />;
            case "environment-variables":
                return <EnvVariables />;
            case "settings":
                return <Settings />;
            case "automations":
                return <Automations />;
            case "tools-integrations":
                return <ToolsIntegrations />;
            case "traces":
                return <Traces />;
            case "usage":
                return <UsagePage />;
            case "billing":
                return <BillingPage />;
            case "crew-studio":
            default:
                return <CrewStudio />;
        }
    };

    return (
        <div className="flex h-full flex-col bg-white dark:bg-[#171717] autonomous-theme">
            <WorkspaceHeader />

            <div className="min-h-0 flex-1 overflow-hidden">
                {renderAutonomousRoute()}
            </div>
            <ToolExecutionStream />
        </div>
    );
}
