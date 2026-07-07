import { SettingsIPC, SettingsIPCSetter } from "../SettingsIPC";

export type SettingsApi = SettingsIPCSetter & {
    get: () => Promise<SettingsIPC>;
    onChanged: (callback: (settings: SettingsIPC) => void) => () => void;
};
