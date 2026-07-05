import { ipcMain } from "electron";

import { LocalizationService } from "./LocalizationService";
import {LocalizationBundle} from "../../shared/localization/types/LocalizationBundle";

export function setupLocalizationIpc(localizationService: LocalizationService): void {
    ipcMain.handle("localization:get-bundle", (): LocalizationBundle => localizationService.getBundle());
    ipcMain.handle("localization:set-locale", (_event, locale: string): Promise<LocalizationBundle> => localizationService.setLocale(locale));
}
