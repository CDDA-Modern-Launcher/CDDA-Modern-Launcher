import { Drawer, Stack, Title } from "@mantine/core";
import React from "react";

import { useSettingsIPC } from "../../hooks/useSettingsIPC";
import { useLocalization } from "../../localization/LocalizationContext";
import { SheetSection } from "@renderer/components/settings/SheetSection";
import { SettingsSheetTitle } from "@renderer/components/settings/SettingsSheetTitle";
import { AutoBackupLimit } from "@renderer/components/settings/AutoBackupLimit";
import { AutoBackupCooldown } from "@renderer/components/settings/AutoBackupCooldown";
import { ManualBackupRotation } from "@renderer/components/settings/ManualBackupRotation";
import { BackupEnabledSwitch } from "@renderer/components/settings/BackupEnabledSwitch";
import { ReleaseAssertVariant } from "@renderer/components/settings/ReleaseAssertVariant";

type SettingsSheetProps = {
    opened: boolean;
    onClose: () => void;
};

export function SettingsSheet({ opened, onClose }: SettingsSheetProps): React.JSX.Element {
    const { t } = useLocalization();
    const settings = useSettingsIPC();

    return (
        <Drawer opened={opened} onClose={onClose} position="right" size={420} title={<Title order={3}>{t("settings.title")}</Title>}>
            <Stack gap="xl">
                <SettingsSheetTitle />

                <SheetSection title={t("settings.game.title")}>
                    <ReleaseAssertVariant settings={settings} />
                </SheetSection>

                <SheetSection title={t("settings.backups.title")} rightSection={<BackupEnabledSwitch settings={settings} />}>
                    <AutoBackupLimit settings={settings} />
                    <AutoBackupCooldown settings={settings} />
                    <ManualBackupRotation settings={settings} />
                </SheetSection>
            </Stack>
        </Drawer>
    );
}
