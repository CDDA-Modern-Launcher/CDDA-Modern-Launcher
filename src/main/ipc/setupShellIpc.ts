import { ipcMain, shell } from "electron";
import { Bridge } from "../../shared/bridge-api/Bridge";

export function setupShellIpc(): void {
    ipcMain.handle(Bridge.Shell.openExternal, async (_event, url: string) => {
        let parsed: URL;

        try {
            parsed = new URL(url);
        } catch {
            return false;
        }

        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
            return false;
        }

        await shell.openExternal(parsed.toString());
        return true;
    });
}
