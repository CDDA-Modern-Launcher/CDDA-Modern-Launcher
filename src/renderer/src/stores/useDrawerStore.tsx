import { create } from "zustand";

type TDrawer = { kind: null } | { kind: "backups" } | { kind: "mods" } | { kind: "settings" } | { kind: "game-bundles" };

interface State {
    drawer: TDrawer;
    openDrawer: (drawer: TDrawer) => void;
    close: () => void;
}

export const useDrawerStore = create<State>((set) => ({
    drawer: { kind: null },
    openDrawer: (drawer: TDrawer) => set({ drawer }),
    close: () => set({ drawer: { kind: null } })
}));

export function useOpenDrawerSimple(): (kind: TDrawer["kind"]) => void {
    const openDrawer = useDrawerStore((state) => state.openDrawer);
    return (kind: TDrawer["kind"]) => openDrawer({ kind });
}

export function useIsDrawerOpened(kind: TDrawer["kind"]): boolean {
    const drawer = useDrawerStore((state) => state.drawer);
    return kind === drawer.kind;
}
