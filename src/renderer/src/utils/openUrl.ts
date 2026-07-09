export async function openUrl(url: string): Promise<boolean> {
    return await window.api.shell.openExternal(url);
}
