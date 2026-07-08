import type React from "react";
import type { TextProps } from "@mantine/core";
import { Text } from "@mantine/core";
import type { FormatArgs } from "../../../shared/FormatArgs";
import type { LocaleKeys } from "../../../shared/localization/types/LocaleFile";
import { useTranslateHtml } from "@renderer/stores/useLocaleStore";

type Props = TextProps & {
    i18nKey: LocaleKeys;
    variables?: FormatArgs;
};

export function LocalizedText({ i18nKey, variables, ...props }: Props): React.JSX.Element {
    const tHtml = useTranslateHtml();
    return <Text {...props} dangerouslySetInnerHTML={{ __html: tHtml(i18nKey, variables) }} />;
}
