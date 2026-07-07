export type GameFileOperationKind = "installing-bundle" | "activating-bundle" | "deleting-bundle" | "creating-backup" | "restoring-backup" | "deleting-backup" | "renaming-backup";

export type GameFileOperationState =
    | { status: "idle" }
    | {
          status: "running";
          kind: GameFileOperationKind;
      };
