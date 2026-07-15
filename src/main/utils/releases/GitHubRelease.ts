import { GitHubAsset } from "./GitHubAsset";

export type GitHubRelease = {
    id?: number;
    name?: string | null;
    tag_name?: string;
    published_at?: string;
    html_url?: string;
    body?: string | null;
    draft?: boolean;
    prerelease?: boolean;
    assets?: GitHubAsset[];
};
