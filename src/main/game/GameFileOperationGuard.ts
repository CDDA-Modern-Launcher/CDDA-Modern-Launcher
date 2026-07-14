import { translate } from "../LocalizationService";
import { GameFileOperationKind, GameFileOperationState } from "../../shared/game-bundle/GameFileOperationState";
import { ipcMain } from "electron";
import { Bridge } from "../../shared/bridge-api/Bridge";
import { broadcastIPC } from "../utils/broadcastIPC";

class GameFileOperationGuard {
    private operation: GameFileOperationState = { status: "idle" };

    async initialize(): Promise<void> {
        ipcMain.handle(Bridge.Game.getFileOperation, () => gameFileOperationGuard.getState());
    }

    getState(): GameFileOperationState {
        return this.operation;
    }

    isRunning(): boolean {
        return this.operation.status === "running";
    }

    busyResult<T extends { status: string; message?: string }>(): T {
        return { status: "blocked", message: translate("game.error.file.operation.busy") } as T;
    }

    async run<T extends { status: string; message?: string }>(kind: GameFileOperationKind, action: () => Promise<T>): Promise<T> {
        if (this.isRunning()) {
            return this.busyResult<T>();
        }

        this.setState({ status: "running", kind });

        try {
            return await action();
        } finally {
            this.setState({ status: "idle" });
        }
    }

    private setState(operation: GameFileOperationState): void {
        this.operation = operation;
        broadcastIPC(Bridge.Game.fileOperationChanged, operation);
    }
}

export const gameFileOperationGuard = new GameFileOperationGuard();
