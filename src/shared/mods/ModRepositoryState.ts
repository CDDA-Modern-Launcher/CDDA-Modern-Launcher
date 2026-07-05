import { ModInstanceInfo } from "./ModInstanceInfo";

export type ModRepositoryState = {
    status: "unconfigured" | "ready" | "error";
    repositoryPath?: string;
    channelId?: string;
    modRepositoryPath?: string;
    mods: ModInstanceInfo[];
    checking: boolean;
    message?: string;
};
