import "@mantine/core/styles.css";
import "./assets/main.css";

import { Root } from "@renderer/Root";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <Root />
    </StrictMode>
);
