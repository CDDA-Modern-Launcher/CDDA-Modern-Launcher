import { ModRepositoryState } from "./ModRepositoryState";

export type ModRepositoryNoticeEvent = {
    type: "updates-available";
    updateCount: number;
    dirtyCount: number;
    state: ModRepositoryState;
};
