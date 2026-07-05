import { ModInfo } from "./ModInfo";
import { TModRepositoryItemStatus } from "./TModRepositoryItemStatus";

export type ModInstanceInfo = ModInfo & {
    status: TModRepositoryItemStatus;
    absolutePath: string;
    error?: string;
};
