import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import App from "@renderer/App";
import { useSystemAppearance } from "@renderer/hooks/useSystemAppearance";
import { LocalizationProvider } from "@renderer/localization/LocalizationProvider";
import React from "react";

const APP_MODAL_PROPS = {
    centered: true,
    radius: "lg",
    overlayProps: { backgroundOpacity: 0.45, blur: 8 },
    transitionProps: { transition: "pop", duration: 180 }
} as const;

export function Root(): React.JSX.Element {
    const appearance = useSystemAppearance();

    return (
        <MantineProvider forceColorScheme={appearance.colorScheme}>
            <ModalsProvider modalProps={APP_MODAL_PROPS}>
                <LocalizationProvider>
                    <App />
                </LocalizationProvider>
            </ModalsProvider>
        </MantineProvider>
    );
}
