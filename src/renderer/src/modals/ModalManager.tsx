import React, { useEffect } from "react";
import { useModalInfo } from "@renderer/modals/useModalStore";
import { GameBundleInstallOptionsModal } from "@renderer/modals/impl/GameBundleInstallOptionsModal";
import { ReleaseNotesModal } from "@renderer/modals/impl/ReleaseNotesModal";
import { DeleteGameBundleModal } from "@renderer/modals/impl/DeleteGameBundleModal";
import { AddGitModModal } from "@renderer/modals/impl/AddGitModModal";
import { RenameBackupModal } from "@renderer/modals/impl/RenameBackupModal";

export function ModalManager(): React.JSX.Element {
    const modal = useModalInfo();

    useEffect(() => {
        console.log("modal:", modal);
    }, [modal]);

    return (
        <>
            <ReleaseNotesModal notes={modal.kind === "release-notes" ? modal.notes : undefined} />

            <DeleteGameBundleModal gameBundle={modal.kind === "delete-game-bundle" ? modal.gameBundle : undefined} onConfirm={modal.kind === "delete-game-bundle" ? modal.onConfirm : undefined} />

            <GameBundleInstallOptionsModal
                release={modal.kind === "game-bundle-options" ? modal.release : undefined}
                hasInstalledVersions={modal.kind === "game-bundle-options" ? modal.hasInstalledVersions : false}
                onConfirm={modal.kind === "game-bundle-options" ? modal.onConfirm : undefined}
            />

            <AddGitModModal opened={modal.kind === "add-git-mod"} />

            <RenameBackupModal backup={modal.kind === "rename-backup" ? modal.backup : undefined} onConfirm={modal.kind === "rename-backup" ? modal.onConfirm : undefined} />
        </>
    );
}
