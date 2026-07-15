import React, { ReactNode, useCallback } from "react";
import { ModInstanceInfo } from "../../../../shared/mods/ModInstanceInfo";
import { ActionIcon, Menu, Tooltip } from "@mantine/core";
import { IconDots, IconFolder, IconRefresh, IconRefreshAlert, IconX } from "@tabler/icons-react";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { useModsStore } from "@renderer/stores/useModsStore";
import { useShallow } from "zustand/react/shallow";
import { modals } from "@mantine/modals";
import { LocalizedText } from "@renderer/components/LocalizedText";

interface Props {
    mod: ModInstanceInfo;
}

const btnIconProps = { size: 20, stroke: 1.5 };

export const ModCardActions = React.memo(function ModCardActions({ mod }: Props): ReactNode {
    const t = useTranslate();

    const { update, remove, openFolder, busyAction, busyModId } = useModsStore(
        useShallow((state) => ({
            update: state.update,
            remove: state.remove,
            openFolder: state.openFolder,
            busyAction: state.busyAction,
            busyModId: state.busyModId
        }))
    );

    const forceUpdateMod = useCallback(
        () =>
            modals.openConfirmModal({
                title: t("content.sheet.mods.update.force.confirm.title"),
                children: (
                    <LocalizedText
                        size="sm"
                        i18nKey={
                            mod.hasLocalChanges && mod.hasUnpushedCommits
                                ? "content.sheet.mods.update.force.confirm.local.and.unpushed"
                                : mod.hasUnpushedCommits
                                  ? "content.sheet.mods.update.force.confirm.unpushed"
                                  : "content.sheet.mods.update.force.confirm"
                        }
                        variables={{ name: mod.displayName }}
                    />
                ),
                labels: { confirm: t("common.update"), cancel: t("common.cancel") },
                confirmProps: { color: "red" },
                onConfirm: () => void update(mod, true)
            }),
        [mod, t, update]
    );

    const removeMod = useCallback(
        () =>
            modals.openConfirmModal({
                title: t("content.sheet.mods.remove.confirm.title"),
                children: <LocalizedText size="sm" i18nKey="content.sheet.mods.remove.confirm" variables={{ name: mod.displayName }} />,
                labels: { confirm: t("common.delete"), cancel: t("common.cancel") },
                confirmProps: { color: "red" },
                onConfirm: () => void remove(mod)
            }),
        [mod, remove, t]
    );

    return (
        <Menu shadow="md" disabled={busyAction !== null}>
            <Menu.Target>
                <ActionIcon size={30} variant="subtle" onClick={() => {}} disabled={busyAction !== null} loading={busyModId === mod.id && busyAction === "remove"}>
                    <IconDots {...btnIconProps} />
                </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Label>
                    <LocalizedText i18nKey="content.sheet.mods.actions.label" />
                </Menu.Label>

                {mod.sourceType === "git" &&
                    (mod.hasLocalChanges || mod.hasUnpushedCommits ? (
                        <Tooltip label={<LocalizedText i18nKey="content.sheet.mods.update.force.button.tooltip" />}>
                            <Menu.Item color="orange" leftSection={<IconRefreshAlert {...btnIconProps} />} onClick={forceUpdateMod}>
                                <LocalizedText i18nKey="content.sheet.mods.update.force.button" />
                            </Menu.Item>
                        </Tooltip>
                    ) : (
                        <Tooltip label={<LocalizedText i18nKey="content.sheet.mods.update.button.tooltip" />}>
                            <Menu.Item color="green" leftSection={<IconRefresh {...btnIconProps} />} onClick={() => update(mod)}>
                                <LocalizedText i18nKey="content.sheet.mods.update.button" />
                            </Menu.Item>
                        </Tooltip>
                    ))}

                <Menu.Item leftSection={<IconFolder {...btnIconProps} />} onClick={() => openFolder(mod)}>
                    <LocalizedText i18nKey="content.sheet.selection.open.folder" />
                </Menu.Item>

                <Menu.Item color="red" leftSection={<IconX {...btnIconProps} />} onClick={removeMod}>
                    <LocalizedText i18nKey="content.sheet.mods.remove.button" />
                </Menu.Item>
            </Menu.Dropdown>
        </Menu>
    );
});
