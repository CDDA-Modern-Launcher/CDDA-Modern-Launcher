import React from "react";
import { Text } from "@mantine/core";

export function ThemeIcon({ icon }: { icon: string | undefined }): React.JSX.Element | null {
    if (icon === undefined) {
        return null;
    }

    return (
        <Text component="span" aria-hidden="true" className="theme-select-icon">
            {icon}
        </Text>
    );
}
