import { Drawer, Stack, Title } from "@mantine/core";
import React from "react";
import { useLocalization } from "../localization/LocalizationContext";
import { SheetSection } from "@renderer/components/SheetSection";
import { SettingsSheetTitle } from "@renderer/components/SettingsSheetTitle";
import { AutoBackupLimit } from "@renderer/components/AutoBackupLimit";
import { AutoBackupCooldown } from "@renderer/components/AutoBackupCooldown";
import { ManualBackupRotation } from "@renderer/components/ManualBackupRotation";
import { BackupEnabledSwitch } from "@renderer/components/BackupEnabledSwitch";
import { ReleaseAssertVariantView } from "@renderer/components/ReleaseAssertVariantView";

type SettingsSheetProps = {
    opened: boolean;
    onClose: () => void;
};

export function SettingsSheet({ opened, onClose }: SettingsSheetProps): React.JSX.Element {
    const { t } = useLocalization();

    return (
        <Drawer opened={opened} onClose={onClose} position="right" size={420} title={<Title order={3}>{t("settings.title")}</Title>}>
            <Stack gap="xl">
                <SettingsSheetTitle />

                <SheetSection title={t("settings.game.title")}>
                    <ReleaseAssertVariantView />
                </SheetSection>

                <SheetSection title={t("settings.backups.title")} rightSection={<BackupEnabledSwitch />}>
                    <AutoBackupLimit />
                    <AutoBackupCooldown />
                    <ManualBackupRotation />
                </SheetSection>
            </Stack>
        </Drawer>
    );
}
