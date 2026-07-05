import { DistributiveInfo } from "./DistributiveInfo";

export type Distributive = {
    id: string;
    path: string;
    userdataPath: string;
    manifest: DistributiveInfo;
    isActive: boolean;
};
