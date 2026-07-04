import { MantineProvider } from "@mantine/core";
import App from "@renderer/App";
import { useSystemAppearance } from "@renderer/hooks/useSystemAppearance";
import React from "react";

export function Root(): React.JSX.Element {
    const appearance = useSystemAppearance();

    return (
        <MantineProvider forceColorScheme={appearance.colorScheme}>
            <App />
        </MantineProvider>
    );
}
