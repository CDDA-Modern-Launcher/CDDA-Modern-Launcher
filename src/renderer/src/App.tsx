import React from "react";

import { RepositoryGate } from "./components/RepositoryGate";
import { UpdateFloatingCard } from "./components/UpdateFloatingCard";

export default function App(): React.JSX.Element {
    return (
        <>
            <UpdateFloatingCard />

            <main className="app-shell">
                <RepositoryGate />
            </main>
        </>
    );
}
