import { GithubRelease } from "../../shared/GithubRelease";

type GameStatePublisher = (latestRelease?: GithubRelease | null) => void | Promise<void>;
type ActiveBundleSynchronizer = () => void | Promise<void>;

let publisher: GameStatePublisher | null = null;
let activeBundleSynchronizer: ActiveBundleSynchronizer | null = null;

export function registerGameStatePublisher(value: GameStatePublisher): void {
    publisher = value;
}

export function registerActiveBundleSynchronizer(value: ActiveBundleSynchronizer): void {
    activeBundleSynchronizer = value;
}

export async function synchronizeActiveBundle(): Promise<void> {
    await activeBundleSynchronizer?.();
}

export async function publishGameState(latestRelease?: GithubRelease | null): Promise<void> {
    await publisher?.(latestRelease);
}
