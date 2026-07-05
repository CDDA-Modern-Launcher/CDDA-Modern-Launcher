export type UpdateState =
    | { status: "idle" }
    | { status: "checking" }
    | { status: "available"; version: string }
    | { status: "downloading"; version: string; percent: number }
    | { status: "downloaded"; version: string }
    | { status: "not-available"; version?: string }
    | { status: "skipped"; version: string }
    | { status: "error"; message: string; messageKey?: string };
