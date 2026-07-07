import React from "react";
import { WorkspaceLoadingView } from "@renderer/components/WorkspaceLoadingView";
import { WorkspaceInvalidView } from "@renderer/components/WorkspaceInvalidView";
import { useWorkspaceStore } from "@renderer/stores/useWorkspaceStore";
import { WorkspaceReadyView } from "@renderer/components/WorkspaceReadyView";

export function WorkspaceView(): React.JSX.Element {
    const repository = useWorkspaceStore((state) => state.workspaceStatus);
    switch (repository.status) {
        case "invalid":
        case "unconfigured":
            return <WorkspaceInvalidView />;
        case "loading":
            return <WorkspaceLoadingView path={repository.path} />;
        case "ready":
            return <WorkspaceReadyView repository={repository} />;
    }
}
