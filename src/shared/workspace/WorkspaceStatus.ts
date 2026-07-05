import { RepositoryConfig } from "../RepositoryConfig";

export type WorkspaceStatus = { status: "unconfigured" } | { status: "loading"; path: string } | { status: "ready"; path: string; config: RepositoryConfig } | { status: "invalid"; path: string; message: string };
