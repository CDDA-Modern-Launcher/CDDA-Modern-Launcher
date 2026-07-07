export type GameRuntimeState = { status: "idle" } | { status: "running"; pid: number; gameBundleId: string; worldName: string | null };
