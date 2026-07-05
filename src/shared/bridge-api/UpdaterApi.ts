import { UpdateState } from "./types/UpdateState";

export type UpdaterApi = {
    getState: () => Promise<UpdateState>;
    checkNow: () => Promise<UpdateState>;
    installNow: () => Promise<boolean>;
    dismiss: () => Promise<UpdateState>;
    skipVersion: (version: string) => Promise<UpdateState>;
    showMockDownloadedUpdate: (version?: string) => Promise<UpdateState>;
    onStateChanged: (callback: (state: UpdateState) => void) => () => void;
};
