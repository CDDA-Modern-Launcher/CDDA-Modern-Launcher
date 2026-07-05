export type GameRuntimeState = { status: "idle" } | { status: "running"; pid: number; installId: string; worldName: string | null };
