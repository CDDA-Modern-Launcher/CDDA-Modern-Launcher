import { type ChildProcess, spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import type { LocalizationService } from "../LocalizationService";
import { GameRuntimeState } from "../../shared/GameRuntimeState";
import { GameBundle } from "../../shared/game-bundle/GameBundle";
import { EGameLaunchResult } from "../../shared/launch/EGameLaunchResult";
import { EGameStopResult } from "../../shared/launch/EGameStopResult";
import { GameLaunchOptions } from "../../shared/launch/GameLaunchOptions";
import { findExecutable } from "../utils/findExecutable";
import { pathExists } from "../utils/pathExists";
import { GameEvents } from "./GameEvents";

export class GameRuntimeService {
    private runtime: GameRuntimeState = { status: "idle" };
    private process: ChildProcess | null = null;
    private readonly preferredWorldByGameBundleId = new Map<string, string | null>();

    constructor(
        private readonly events: GameEvents,
        private readonly localizationService: LocalizationService
    ) {}

    getState(): GameRuntimeState {
        return this.runtime;
    }

    getPreferredWorld(gameBundleId: string): string | null {
        return this.preferredWorldByGameBundleId.get(gameBundleId) ?? null;
    }

    async launch(gameBundle: GameBundle | null, options: GameLaunchOptions = {}, onLaunched: (gameBundle: GameBundle) => Promise<void>): Promise<EGameLaunchResult> {
        if (this.runtime.status === "running") return { status: "already-running" };
        if (gameBundle === null) return { status: "unavailable", message: this.localizationService.t("game.error.no.game.bundle") };

        const executablePath = await this.resolveExecutablePath(gameBundle);
        if (executablePath === null) return { status: "unavailable", message: this.localizationService.t("game.error.executable.missing") };

        await mkdir(gameBundle.userdataPath, { recursive: true });
        const args = ["--userdir", gameBundle.userdataPath];
        const worldName = options.worldName?.trim();
        if (worldName !== undefined && worldName.length > 0) args.push("--world", worldName);

        const child = spawn(executablePath, args, { cwd: dirname(executablePath), stdio: "ignore" });
        this.process = child;
        this.preferredWorldByGameBundleId.set(gameBundle.id, worldName ?? null);
        await onLaunched(gameBundle);
        this.setState({ status: "running", pid: child.pid ?? 0, gameBundleId: gameBundle.id, worldName: worldName ?? null });
        child.once("exit", () => this.finishProcess(child));
        child.once("error", () => this.finishProcess(child));
        return { status: "launched" };
    }

    stop(): EGameStopResult {
        if (this.process === null || this.runtime.status !== "running") return { status: "not-running" };
        try {
            this.process.kill();
            this.setState({ status: "idle" });
            this.process = null;
            return { status: "stopped" };
        } catch (error) {
            return { status: "error", message: error instanceof Error ? error.message : String(error) };
        }
    }

    private finishProcess(child: ChildProcess): void {
        if (this.process !== child) return;
        this.process = null;
        this.setState({ status: "idle" });
    }

    private setState(runtime: GameRuntimeState): GameRuntimeState {
        this.runtime = runtime;
        this.events.emitRuntime(runtime);
        return runtime;
    }

    private async resolveExecutablePath(gameBundle: GameBundle): Promise<string | null> {
        const manifestExecutablePath = gameBundle.manifest.executablePath;
        if (manifestExecutablePath !== null && (await pathExists(manifestExecutablePath))) return manifestExecutablePath;
        return findExecutable(gameBundle.path);
    }
}
