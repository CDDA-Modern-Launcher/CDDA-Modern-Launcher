import { MantineProvider } from "@mantine/core";
import App from "@renderer/App";
import { useSystemAppearance } from "@renderer/hooks/useSystemAppearance";
import { LocalizationProvider } from "@renderer/localization/LocalizationProvider";
import React from "react";

export function Root(): React.JSX.Element {
    const appearance = useSystemAppearance();

    return (
        <MantineProvider forceColorScheme={appearance.colorScheme}>
            <LocalizationProvider>
                <App />
            </LocalizationProvider>
        </MantineProvider>
    );
}
