export type InstallProgress =
    | { status: "idle" }
    | { status: "resolving-release"; releaseName?: string }
    | { status: "downloading"; releaseName: string; percent: number | null; transferredBytes: number; totalBytes: number | null }
    | { status: "extracting"; releaseName: string; percent: number }
    | { status: "preparing-saves"; releaseName: string }
    | { status: "finalizing"; releaseName: string }
    | { status: "completed"; releaseName: string }
    | { status: "error"; message: string };
