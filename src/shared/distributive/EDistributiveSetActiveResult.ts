import { DistributiveState } from "./DistributiveState";

export type EDistributiveSetActiveResult = { status: "updated"; state: DistributiveState } | { status: "unavailable" | "error"; message: string };
