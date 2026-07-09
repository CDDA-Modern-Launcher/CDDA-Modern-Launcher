import { GameBundle } from "../../../shared/game-bundle/GameBundle";
import { ContextModalProps, modals, type OpenContextModal } from "@mantine/modals";
import React from "react";
import { DeleteGameBundleModal } from "@renderer/modals/impl/DeleteGameBundleModal";
import { ReleaseNotesTarget } from "@renderer/types/ReleaseNotesTarget";
import { ReleaseNotesModal } from "@renderer/modals/impl/ReleaseNotesModal";
import { BackupInstanceInfo } from "../../../shared/backups/types/BackupInstanceInfo";
import { RenameBackupModal } from "@renderer/modals/impl/RenameBackupModal";
import { InstallReleaseModal } from "@renderer/modals/impl/InstallReleaseModal";
import { GithubRelease } from "../../../shared/GithubRelease";
import { AddGitModModalNew } from "@renderer/modals/impl/AddGitModModal";

export type ModalPayloads = {
    deleteBackup: { gameBundle: GameBundle };
    showReleaseNotes: { notes: ReleaseNotesTarget };
    renameBackup: { backup: BackupInstanceInfo };
    installRelease: { release: GithubRelease; hasInstalledVersions: boolean };
    addModFromGit: { _?: void };
};

type AppContextModals = {
    [TName in keyof ModalPayloads]: React.FC<ContextModalProps<ModalPayloads[TName]>>;
};

type OpenModalOptions = Omit<OpenContextModal, "modal" | "title" | "innerProps">;

type AppContextModalDefaults = Partial<{
    [TName in keyof ModalPayloads]: OpenModalOptions;
}>;

export const contextModals: AppContextModals = {
    deleteBackup: DeleteGameBundleModal,
    showReleaseNotes: ReleaseNotesModal,
    renameBackup: RenameBackupModal,
    installRelease: InstallReleaseModal,
    addModFromGit: AddGitModModalNew
};

const contextModalDefaults: AppContextModalDefaults = {
    showReleaseNotes: {
        size: "90vw"
    }
};

export function openModal<TName extends keyof ModalPayloads>(modal: TName, title: string, innerProps: ModalPayloads[TName], options?: OpenModalOptions): string {
    return modals.openContextModal({
        modal,
        title,
        innerProps,
        ...contextModalDefaults[modal],
        ...options
    });
}
