import type { LocalizationService } from "../LocalizationService";
import { GameFileOperationKind, GameFileOperationState } from "../../shared/game-bundle/GameFileOperationState";
import { GameEvents } from "./GameEvents";

export class GameFileOperationGuard {
    private operation: GameFileOperationState = { status: "idle" };

    constructor(
        private readonly events: GameEvents,
        private readonly localizationService: LocalizationService
    ) {}

    getState(): GameFileOperationState {
        return this.operation;
    }

    isRunning(): boolean {
        return this.operation.status === "running";
    }

    busyResult<T extends { status: string; message?: string }>(): T {
        return { status: "blocked", message: this.localizationService.t("game.error.file.operation.busy") } as T;
    }

    async run<T extends { status: string; message?: string }>(kind: GameFileOperationKind, action: () => Promise<T>): Promise<T> {
        if (this.isRunning()) return this.busyResult<T>();
        this.setState({ status: "running", kind });
        try {
            return await action();
        } finally {
            this.setState({ status: "idle" });
        }
    }

    private setState(operation: GameFileOperationState): void {
        this.operation = operation;
        this.events.emitFileOperation(operation);
    }
}
