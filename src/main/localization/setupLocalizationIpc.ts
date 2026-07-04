import { ipcMain } from "electron";

import { LocalizationBundle } from "../../shared/localization";
import { LocalizationService } from "./LocalizationService";

export function setupLocalizationIpc(localizationService: LocalizationService): void {
    ipcMain.handle("localization:get-bundle", (): LocalizationBundle => localizationService.getBundle());
    ipcMain.handle("localization:set-locale", (_event, locale: string): Promise<LocalizationBundle> => localizationService.setLocale(locale));
}
