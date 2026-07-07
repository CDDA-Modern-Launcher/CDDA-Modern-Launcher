import { GameBundle } from "../../shared/distributive/GameBundle";

export function findUserdataSource(installs: GameBundle[], activeInstallId: string | undefined): GameBundle | null {
    return (activeInstallId === undefined ? undefined : installs.find((install) => install.id === activeInstallId)) ?? installs[0] ?? null;
}
