import { useLocalization } from "@renderer/localization/LocalizationContext";
import React from "react";

export function T({ children }: { children: string }): React.JSX.Element {
    const { t } = useLocalization();
    return <>{t(children)}</>;
}
