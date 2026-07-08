import { AppearanceApi, AppearanceBundle } from "../../shared/bridge-api/AppearanceApi";
import { ipcRenderer, type IpcRendererEvent } from "electron";
import { TAppThemeSource } from "../../shared/appearance/TAppThemeSource";
import { TAppTheme } from "../../shared/appearance/TAppTheme";
import { Bridge } from "../../shared/bridge-api/Bridge";

export function registerPreloadAppearanceApi(): AppearanceApi {
    return {
        getInitialAppearance: (): AppearanceBundle => ipcRenderer.sendSync(Bridge.Appearance.getInitialAppearance) as AppearanceBundle,
        getThemeSource: (): Promise<TAppThemeSource> => ipcRenderer.invoke(Bridge.Appearance.getThemeSource),
        setThemeSource: async (appearance: TAppThemeSource): Promise<AppearanceBundle> => ipcRenderer.invoke(Bridge.Appearance.setThemeSource, appearance),

        getTheme: (): Promise<TAppTheme> => ipcRenderer.invoke(Bridge.Appearance.getTheme),

        onAppearanceChanged: (callback: (appearance: { themeSource: TAppThemeSource; theme: TAppTheme }) => void) => {
            const listener = (_event: IpcRendererEvent, appearance: { themeSource: TAppThemeSource; theme: TAppTheme }): void => callback(appearance);
            ipcRenderer.on(Bridge.Appearance.onAppearanceChanged, listener);
            return () => ipcRenderer.removeListener(Bridge.Appearance.onAppearanceChanged, listener);
        }
    };
}
