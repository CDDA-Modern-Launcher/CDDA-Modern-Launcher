import { ipcMain } from "electron";

import { LocalizationService } from "../LocalizationService";
import { LocalizationBundle } from "../../shared/localization/types/LocalizationBundle";
import { Bridge } from "../../shared/bridge-api/Bridge";

export function setupLocalizationIpc(localizationService: LocalizationService): void {
    ipcMain.handle(Bridge.Localization.getBundle, (): LocalizationBundle => localizationService.getBundle());
    ipcMain.handle(Bridge.Localization.setLocale, (_event, locale: string): LocalizationBundle => localizationService.setLocale(locale));
}
