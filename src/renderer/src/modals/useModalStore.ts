import { create } from "zustand";
import { BackupInstanceInfo } from "../../../shared/backups/types/BackupInstanceInfo";
import { GameBundle } from "../../../shared/distributive/GameBundle";
import { GithubRelease } from "../../../shared/GithubRelease";
import { ReleaseNotesTarget } from "@renderer/types/ReleaseNotesTarget";
import { useCallback, useEffect, useState } from "react";

export type ModalPayload =
    | { kind: null }
    | { kind: "delete-backup"; backup: BackupInstanceInfo; onConfirm: (backup: BackupInstanceInfo) => void }
    | { kind: "release-notes"; notes: ReleaseNotesTarget }
    | { kind: "delete-install"; distributive: GameBundle; onConfirm: (distributive: GameBundle, deleteUserdata: boolean) => void }
    | { kind: "install-options"; release: GithubRelease; hasInstalledVersions: boolean; onConfirm: (release: GithubRelease, copyUserdata: boolean, removeOlderInstalls: boolean) => Promise<void> }
    | { kind: "add-git-mod" }
    | { kind: "rename-backup"; backup: BackupInstanceInfo; onConfirm: (backup: BackupInstanceInfo, comment: string) => Promise<void> };

interface State {
    modal: ModalPayload;
    open: (modal: Exclude<ModalPayload, { kind: null }>) => void;
    close: () => void;
}

const useModalStore = create<State>()((set) => ({
    modal: { kind: null },
    open: (modal) => {
        console.log("useModalOpen", modal, new Error());
        set({ modal });
    },
    close: () => set({ modal: { kind: null } })
}));

export function useModalOpen(): State["open"] {
    return useModalStore((state) => state.open);
}

export function useModalClose(): State["close"] {
    return useModalStore((state) => state.close);
}

export function useModalInfo(): State["modal"] {
    return useModalStore((state) => state.modal);
}

/** A bit crutchy thing to prevent data from visually loss while modal goes off with animation.  */
export function useModalCloseWithLatch<T>(value: T | undefined): [() => void, T | undefined, () => void] {
    const [latchedValue, setLatchedValue] = useState<T | undefined>(value);
    const close = useModalStore((state) => state.close);

    useEffect(() => {
        if (value) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLatchedValue(value);
        }
    }, [value]);

    const clean = useCallback(() => setLatchedValue(undefined), []);

    return [close, latchedValue, clean];
}
