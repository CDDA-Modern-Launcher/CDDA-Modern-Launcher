import { DistributiveState } from "./DistributiveState";
import { Distributive } from "./Distributive";

export type EInstallDistributiveResult = { status: "installed"; state: DistributiveState; install: Distributive } | { status: "unavailable" | "error"; message: string };
