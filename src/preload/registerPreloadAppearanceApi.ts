import { AppearanceApi, AppearanceApiKey, AppearanceBundle } from "../shared/bridge-api/AppearanceApi";
import { ipcRenderer, type IpcRendererEvent } from "electron";
import { TAppThemeSource } from "../shared/appearance/TAppThemeSource";
import { TAppTheme } from "../shared/appearance/TAppTheme";

export function registerPreloadAppearanceApi(): AppearanceApi {
    return {
        getThemeSource: (): Promise<TAppThemeSource> => ipcRenderer.invoke(AppearanceApiKey.getThemeSource),
        setThemeSource: async (appearance: TAppThemeSource): Promise<AppearanceBundle> => ipcRenderer.invoke(AppearanceApiKey.setThemeSource, appearance),

        getTheme: (): Promise<TAppTheme> => ipcRenderer.invoke(AppearanceApiKey.getTheme),

        onAppearanceChanged: (callback: (appearance: { themeSource: TAppThemeSource; theme: TAppTheme }) => void) => {
            const listener = (_event: IpcRendererEvent, appearance: { themeSource: TAppThemeSource; theme: TAppTheme }): void => callback(appearance);
            ipcRenderer.on(AppearanceApiKey.onAppearanceChanged, listener);
            return () => ipcRenderer.removeListener(AppearanceApiKey.onAppearanceChanged, listener);
        }
    };
}
