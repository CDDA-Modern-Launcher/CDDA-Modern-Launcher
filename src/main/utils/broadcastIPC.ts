import { BrowserWindow } from "electron";
import { BridgeChannel } from "../../shared/bridge-api/Bridge";

export function broadcastIPC(channel: BridgeChannel, payload: unknown): void {
    for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(channel, payload);
    }
}
