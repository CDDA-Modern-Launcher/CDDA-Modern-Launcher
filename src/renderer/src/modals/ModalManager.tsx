import React, { useEffect } from "react";
import { useModalInfo } from "@renderer/modals/useModalStore";
import { DeleteBackupModal } from "@renderer/modals/impl/DeleteBackupModal";
import { InstallOptionsModal } from "@renderer/modals/impl/InstallOptionsModal";
import { ReleaseNotesModal } from "@renderer/modals/impl/ReleaseNotesModal";
import { DeleteInstallModal } from "@renderer/modals/impl/DeleteInstallModal";
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

            <DeleteBackupModal backup={modal.kind === "delete-backup" ? modal.backup : undefined} onConfirm={modal.kind === "delete-backup" ? modal.onConfirm : undefined} />

            <DeleteInstallModal distributive={modal.kind === "delete-install" ? modal.distributive : undefined} onConfirm={modal.kind === "delete-install" ? modal.onConfirm : undefined} />

            <InstallOptionsModal
                release={modal.kind === "install-options" ? modal.release : undefined}
                hasInstalledVersions={modal.kind === "install-options" ? modal.hasInstalledVersions : false}
                onConfirm={modal.kind === "install-options" ? modal.onConfirm : undefined}
            />

            <AddGitModModal opened={modal.kind === "add-git-mod"} />

            <RenameBackupModal backup={modal.kind === "rename-backup" ? modal.backup : undefined} onConfirm={modal.kind === "rename-backup" ? modal.onConfirm : undefined} />
        </>
    );
}
