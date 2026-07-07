import { RepositoryConfig } from "../../shared/RepositoryConfig";

export function areWorkspaceConfigsEqual(left: RepositoryConfig, right: RepositoryConfig): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}
