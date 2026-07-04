import React from "react";

import { RepositoryGate } from "./components/RepositoryGate";
import { UpdateFloatingCard } from "./components/UpdateFloatingCard";
import { LocaleSelector } from "./localization/LocaleSelector";

export default function App(): React.JSX.Element {
    return (
        <>
            <UpdateFloatingCard />

            <div className="locale-switcher">
                <LocaleSelector />
            </div>

            <main className="app-shell">
                <RepositoryGate />
            </main>
        </>
    );
}
