import { ReactNode, useCallback } from "react";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { openModal } from "@renderer/modals/contextModals";
import { useModsStore } from "@renderer/stores/useModsStore";
import { useShallow } from "zustand/react/shallow";
import { ActionIcon, Group, Menu, Title, Tooltip } from "@mantine/core";
import { IconPlus, IconQuestionMark, IconRefresh } from "@tabler/icons-react";
import { defaultIconProps } from "@renderer/utils/defaultIconProps";

export function ModDrawerTitle(): ReactNode {
    const t = useTranslate();
    const handleAddGitMod = useCallback(() => openModal("addModFromGit", t("content.sheet.mods.git.modal.title"), {}), [t]);
    const discoverFromArchive = useModsStore((state) => state.discoverFromArchive);
    const installFromFolder = useModsStore((state) => state.installFromFolder);

    const handleAddArchive = useCallback(async () => {
        const result = await discoverFromArchive();
        if (result.status === "selection-required") {
            openModal("selectMods", t("content.sheet.mods.selection.title"), { sessionId: result.sessionId, mods: result.mods }, { size: result.mods.length > 3 ? "xl" : "md" });
        }
    }, [discoverFromArchive, t]);

    const handleAddFolder = useCallback(() => void installFromFolder(), [installFromFolder]);

    const { modRepoState, checkUpdates, busyAction } = useModsStore(
        useShallow((state) => ({
            modRepoState: state.state,
            checkUpdates: state.checkUpdates,
            busyAction: state.busyAction
        }))
    );
    const isRepositoryReady = modRepoState.status === "ready";
    const isBusy = !isRepositoryReady || busyAction !== null;
    const isLoading = busyAction === "check-updates" || modRepoState.checking;

    const handleHelpClick = useCallback(() => openModal("modsHelp", t("content.sheet.mods.help.title"), {}, { size: "lg" }), [t]);

    return (
        <Group gap="md" justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap">
                <Title order={3}>{t("content.sheet.mods.title")}</Title>

                <ActionIcon variant="gradient" color="red" size="sm" radius="xl" style={{ marginBottom: -4 }} aria-label="Hint" onClick={handleHelpClick}>
                    <IconQuestionMark size={14} stroke={2.5} />
                </ActionIcon>
            </Group>

            <Group gap="xs" wrap="nowrap">
                <Menu shadow="md" width={260} position="bottom-end" disabled={isBusy}>
                    <Menu.Target>
                        <Tooltip label={t("content.sheet.mods.add.tooltip")} position="top">
                            <ActionIcon variant="light" radius="md" disabled={isBusy} aria-label={t("content.sheet.mods.add.tooltip")}>
                                <IconPlus {...defaultIconProps} />
                            </ActionIcon>
                        </Tooltip>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Label>{t("content.sheet.mods.add.menu.title")}</Menu.Label>
                        <Menu.Item onClick={handleAddGitMod}>{t("content.sheet.mods.add.from.git")}</Menu.Item>
                        <Menu.Item onClick={handleAddFolder}>{t("content.sheet.mods.add.from.folder")}</Menu.Item>
                        <Menu.Item onClick={() => void handleAddArchive()}>{t("content.sheet.mods.add.from.archive")}</Menu.Item>
                    </Menu.Dropdown>
                </Menu>

                <Tooltip label={t("content.sheet.mods.check.button")} position="top">
                    <ActionIcon variant="subtle" radius="md" onClick={checkUpdates} disabled={isBusy} loading={isLoading} aria-label={t("content.sheet.mods.check.button")}>
                        <IconRefresh {...defaultIconProps} />
                    </ActionIcon>
                </Tooltip>
            </Group>
        </Group>
    );
}
