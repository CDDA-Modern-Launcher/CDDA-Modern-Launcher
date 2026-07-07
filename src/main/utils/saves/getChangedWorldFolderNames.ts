import type { GameSaveSettledActivity } from "../../game/GameSaveMonitor";

export function getChangedWorldFolderNames(activity: GameSaveSettledActivity): string[] {
    const folders = new Set<string>();
    for (const changedPath of activity.keyChangedPaths) {
        const normalized = changedPath.split("\\").join("/");
        const match = /(?:^|\/)save\/([^/]+)\/[^/]+$/.exec(normalized);
        if (match !== null) folders.add(match[1]);
    }
    return [...folders];
}
