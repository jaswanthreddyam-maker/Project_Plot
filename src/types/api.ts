export interface ApiErrorPayload {
    detail?: string;
    error?: string;
    message?: string;
}

export interface ProjectDto {
    id: string;
    title: string;
    description?: string;
    updated_at: string;
    graph?: ProjectGraphDto | null;
}

export interface ProjectGraphNodeDto {
    id: string;
    type?: string | null;
    position?: { x: number; y: number };
    data: Record<string, unknown>;
    [key: string]: unknown;
}

export interface ProjectGraphEdgeDto {
    id?: string | null;
    source: string;
    target: string;
    [key: string]: unknown;
}

export interface ProjectGraphDto {
    nodes: ProjectGraphNodeDto[];
    edges: ProjectGraphEdgeDto[];
}

export interface ProjectUpdatePayload {
    title?: string;
    description?: string;
    graph?: ProjectGraphDto;
}

export interface ToolData {
    [key: string]: unknown;
    name: string;
    category?: string;
    kind?: string;
    description?: string;
    config?: Record<string, unknown>;
}

export interface FlowNodeData {
    [key: string]: unknown;
    label: string;
    kind: string;
    description: string;
    toolData: ToolData;
}

export interface ExecuteFlowNodePayload {
    id: string;
    type?: string | null;
    data: Record<string, unknown>;
}

export interface ExecuteFlowEdgePayload {
    id?: string | null;
    source: string;
    target: string;
}

export interface ExecuteFlowRequestPayload {
    nodes: ExecuteFlowNodePayload[];
    edges: ExecuteFlowEdgePayload[];
    initial_input?: unknown;
}

export interface FlowExecutionLog {
    node_id?: string;
    node_name?: string;
    status: string;
    message: string;
    output_preview?: string;
}

export interface ExecuteFlowResponsePayload {
    logs: FlowExecutionLog[];
    outputs_by_node: Record<string, unknown>;
    final_output: unknown;
    execution_order: string[];
}

export interface ExecuteFlowStreamLogEvent {
    type: "log";
    log: FlowExecutionLog;
}

export interface ExecuteFlowStreamCompleteEvent {
    type: "completed";
    logs: FlowExecutionLog[];
    outputs_by_node: Record<string, unknown>;
    final_output: unknown;
    execution_order: string[];
}

export interface ExecuteFlowStreamErrorEvent {
    type: "error";
    status_code?: number;
    detail?: string;
}

export type ExecuteFlowStreamEvent =
    | ExecuteFlowStreamLogEvent
    | ExecuteFlowStreamCompleteEvent
    | ExecuteFlowStreamErrorEvent;
