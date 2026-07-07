import { LocalizationApi } from "../../shared/bridge-api/LocalizationApi";
import { LocalizationBundle } from "../../shared/localization/types/LocalizationBundle";
import { ipcRenderer, type IpcRendererEvent } from "electron";
import { Bridge } from "../../shared/bridge-api/Bridge";

export function registerPreloadLocalizationApi(): LocalizationApi {
    return {
        getBundle: (): Promise<LocalizationBundle> => ipcRenderer.invoke(Bridge.Localization.getBundle),
        setLocale: (locale: string): Promise<LocalizationBundle> => ipcRenderer.invoke(Bridge.Localization.setLocale, locale),
        onChanged: (callback: (bundle: LocalizationBundle) => void) => {
            const listener = (_event: IpcRendererEvent, bundle: LocalizationBundle): void => callback(bundle);
            ipcRenderer.on(Bridge.Localization.onChanged, listener);
            return () => ipcRenderer.removeListener(Bridge.Localization.onChanged, listener);
        }
    };
}
