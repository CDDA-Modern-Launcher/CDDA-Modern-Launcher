export class GameBundleInstallCancelledError extends Error {
    constructor() {
        super("Game bundle download was cancelled");
        this.name = "GameBundleInstallCancelledError";
    }
}
