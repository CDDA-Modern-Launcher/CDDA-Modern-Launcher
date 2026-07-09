import { create } from "zustand";
import { useCallback } from "react";

type TDrawer = { kind: null } | { kind: "backups" } | { kind: "mods" } | { kind: "settings" } | { kind: "game-bundles" };

interface State {
    drawer: TDrawer;
    openDrawer: (drawer: TDrawer) => void;
    close: () => void;
}

const useDrawerStore = create<State>((set) => ({
    drawer: { kind: null },
    openDrawer: (drawer: TDrawer) => set({ drawer }),
    close: () => set({ drawer: { kind: null } })
}));

export function useCloseDrawer(): () => void {
    const close = useDrawerStore((state) => state.close);
    return () => close();
}

export function useOpenDrawer(kind: TDrawer["kind"]) {
    const openDrawer = useDrawerStore((state) => state.openDrawer);
    return () => openDrawer({ kind });
}

export function useOpenDrawerFn(): (kind: TDrawer["kind"]) => void {
    const openDrawer = useDrawerStore((state) => state.openDrawer);
    return useCallback((kind: TDrawer["kind"]) => openDrawer({ kind }), [openDrawer]);
}

export function useIsDrawerOpened(kind: TDrawer["kind"]): boolean {
    const drawer = useDrawerStore((state) => state.drawer);
    return kind === drawer.kind;
}
