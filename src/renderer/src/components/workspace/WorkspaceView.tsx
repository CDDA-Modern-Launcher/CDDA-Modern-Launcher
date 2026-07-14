import React from "react";
import { WorkspaceLoadingView } from "@renderer/components/workspace/WorkspaceLoadingView";
import { WorkspaceInvalidView } from "@renderer/components/workspace/WorkspaceInvalidView";
import { useWorkspaceStore } from "@renderer/stores/useWorkspaceStore";
import { WorkspaceReadyView } from "@renderer/components/workspace/WorkspaceReadyView";

export function WorkspaceView(): React.JSX.Element {
    const ws = useWorkspaceStore((state) => state.workspaceStatus);
    switch (ws.status) {
        case "invalid":
        case "unconfigured":
            return <WorkspaceInvalidView />;
        case "loading":
            return <WorkspaceLoadingView path={ws.path} />;
        case "ready":
            return <WorkspaceReadyView repository={ws} />;
    }
}
