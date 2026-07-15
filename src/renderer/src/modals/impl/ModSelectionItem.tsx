import { memo, useCallback, type JSX } from "react";
import { Checkbox, Stack, Text } from "@mantine/core";
import { DiscoveredMod } from "../../../../shared/mods/DiscoveredMod";

type ModSelectionItemProps = {
    mod: DiscoveredMod;
    selected: boolean;
    disabled: boolean;
    onToggle: (id: string) => void;
};

export const ModSelectionItem = memo(function ModSelectionItem({ mod, selected, disabled, onToggle }: ModSelectionItemProps): JSX.Element {
    const toggle = useCallback(() => onToggle(mod.id), [mod.id, onToggle]);

    return (
        <Checkbox
            checked={selected}
            disabled={disabled}
            onChange={toggle}
            label={
                <Stack gap={0} style={{ minWidth: 0 }}>
                    <Text fw={600}>{mod.name}</Text>
                    <Text size="xs" c="dimmed">
                        {mod.id}
                        {mod.subdirectory ? ` · ${mod.subdirectory}` : ""}
                    </Text>
                    {mod.description && (
                        <Text size="xs" lineClamp={2}>
                            {mod.description}
                        </Text>
                    )}
                </Stack>
            }
        />
    );
});
