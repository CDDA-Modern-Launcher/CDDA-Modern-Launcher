export type ShellApi = {
    openExternal: (url: string) => Promise<boolean>;
};
