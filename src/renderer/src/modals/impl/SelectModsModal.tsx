import type { ChangeEvent, JSX } from "react";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { Alert, Button, Group, ScrollArea, Stack, Text, TextInput } from "@mantine/core";
import { ContextModalProps, modals } from "@mantine/modals";
import { IconSearch } from "@tabler/icons-react";
import { useModsStore } from "@renderer/stores/useModsStore";
import { useTranslate } from "@renderer/stores/useLocaleStore";
import { DiscoveredMod } from "../../../../shared/mods/DiscoveredMod";
import { ModSelectionItem } from "./ModSelectionItem";

export type SelectModsModalPayload = { sessionId: string; mods: DiscoveredMod[] };

type SearchableMod = {
    mod: DiscoveredMod;
    searchText: string;
};

export function SelectModsModal({ innerProps }: ContextModalProps<SelectModsModalPayload>): JSX.Element {
    const t = useTranslate();
    const mods = innerProps.mods;
    const showSearch = mods.length > 3;
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query);
    const [selected, setSelected] = useState(() => new Set(mods.map((mod) => mod.id)));
    const installSelection = useModsStore((state) => state.installSelection);
    const busy = useModsStore((state) => state.busyAction !== null);
    const error = useModsStore((state) => state.error);
    const count = selected.size;

    const searchableMods = useMemo<SearchableMod[]>(
        () =>
            mods.map((mod) => ({
                mod,
                searchText: [mod.name, mod.id, mod.subdirectory, mod.description]
                    .filter((value): value is string => Boolean(value))
                    .join("\n")
                    .toLocaleLowerCase()
            })),
        [mods]
    );

    const filteredMods = useMemo(() => {
        const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
        if (!normalizedQuery) return mods;

        return searchableMods.filter((item) => item.searchText.includes(normalizedQuery)).map((item) => item.mod);
    }, [deferredQuery, mods, searchableMods]);

    const changeQuery = useCallback((event: ChangeEvent<HTMLInputElement>): void => setQuery(event.currentTarget.value), []);

    const toggle = useCallback((id: string): void => {
        setSelected((current) => {
            const next = new Set(current);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const selectAll = useCallback((): void => {
        setSelected(new Set(mods.map((mod) => mod.id)));
    }, [mods]);

    const selectNone = useCallback((): void => {
        setSelected(new Set());
    }, []);

    const install = async (): Promise<void> => {
        if (await installSelection(innerProps.sessionId, [...selected])) modals.closeAll();
    };

    return (
        <Stack gap="md">
            <Text size="sm" c="dimmed">
                {t("content.sheet.mods.selection.description")}
            </Text>
            {showSearch && <TextInput value={query} onChange={changeQuery} placeholder={t("content.sheet.mods.selection.search.placeholder")} leftSection={<IconSearch size={16} />} autoFocus />}
            {showSearch && (
                <Group justify="space-between" gap="xs">
                    <Text size="xs" c="dimmed">
                        {t("content.sheet.mods.selection.search.result", { count: filteredMods.length, total: mods.length })}
                    </Text>
                    <Group gap="xs">
                        <Button variant="subtle" size="compact-xs" onClick={selectAll} disabled={busy}>
                            {t("content.sheet.mods.selection.select.all")}
                        </Button>
                        <Button variant="subtle" size="compact-xs" onClick={selectNone} disabled={busy}>
                            {t("content.sheet.mods.selection.select.none")}
                        </Button>
                    </Group>
                </Group>
            )}
            <ScrollArea.Autosize mah={showSearch ? "55vh" : undefined} type="auto" offsetScrollbars>
                <Stack gap="xs" pr={showSearch ? "xs" : 0}>
                    {filteredMods.map((mod) => (
                        <ModSelectionItem key={mod.id} mod={mod} selected={selected.has(mod.id)} disabled={busy} onToggle={toggle} />
                    ))}
                    {filteredMods.length === 0 && (
                        <Text size="sm" c="dimmed" ta="center" py="md">
                            {t("content.sheet.mods.selection.search.empty")}
                        </Text>
                    )}
                </Stack>
            </ScrollArea.Autosize>
            {error && <Alert color="red">{error}</Alert>}
            <Group justify="flex-end">
                <Button variant="subtle" onClick={() => modals.closeAll()} disabled={busy}>
                    {t("common.cancel")}
                </Button>
                <Button onClick={() => void install()} disabled={count === 0} loading={busy}>
                    {t("content.sheet.mods.install.selected", { count })}
                </Button>
            </Group>
        </Stack>
    );
}
