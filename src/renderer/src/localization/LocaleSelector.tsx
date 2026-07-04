import { Group, Image, Select, Text } from "@mantine/core";
import React, { useMemo } from "react";

import { LocaleOption } from "../../../shared/localization";
import { useLocalization } from "./LocalizationProvider";

export function LocaleSelector(): React.JSX.Element | null {
    const { selectedLocale, effectiveLocale, options, setLocale, t } = useLocalization();

    const data = useMemo(
        () =>
            options.map((option) => ({
                value: option.locale,
                label: option.nativeName
            })),
        [options]
    );

    if (options.length === 0) {
        return null;
    }

    const currentValue = options.some((option) => option.locale === selectedLocale) ? selectedLocale : effectiveLocale;

    return (
        <Select
            aria-label={t("locale.label")}
            label={t("locale.label")}
            data={data}
            value={currentValue}
            onChange={(value) => {
                if (value !== null) {
                    setLocale(value).catch((error) => console.error("Failed to set locale", error));
                }
            }}
            allowDeselect={false}
            size="xs"
            w={160}
            renderOption={({ option }) => <LocaleOptionRow option={options.find((locale) => locale.locale === option.value)} />}
            leftSection={<LocaleIcon option={options.find((option) => option.locale === currentValue)} />}
        />
    );
}

function LocaleOptionRow({ option }: { option: LocaleOption | undefined }): React.JSX.Element {
    if (option === undefined) {
        return <Text size="sm">—</Text>;
    }

    return (
        <Group gap="xs" wrap="nowrap">
            <LocaleIcon option={option} />
            <Text size="sm">{option.nativeName}</Text>
        </Group>
    );
}

function LocaleIcon({ option }: { option: LocaleOption | undefined }): React.JSX.Element | null {
    if (option === undefined) {
        return null;
    }

    return <Image src={option.iconPng} alt="" w={18} h={12} radius={2} />;
}
