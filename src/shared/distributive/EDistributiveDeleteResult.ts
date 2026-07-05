import { DistributiveState } from "./DistributiveState";

export type EDistributiveDeleteResult = { status: "deleted"; state: DistributiveState } | { status: "unavailable" | "blocked" | "error"; message: string };
