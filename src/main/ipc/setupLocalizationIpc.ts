import { ipcMain } from "electron";

import { l10n } from "../Localization";
import { LocalizationBundle } from "../../shared/localization/types/LocalizationBundle";
import { Bridge } from "../../shared/bridge-api/Bridge";

export function setupLocalizationIpc(): void {
    ipcMain.handle(Bridge.Localization.getBundle, (): LocalizationBundle => l10n.getBundle());
    ipcMain.handle(Bridge.Localization.setLocale, (_event, locale: string): LocalizationBundle => l10n.setLocale(locale));
}
