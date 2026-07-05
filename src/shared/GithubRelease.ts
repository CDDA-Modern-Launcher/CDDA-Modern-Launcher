export type GithubRelease = {
    id: string;
    name: string;
    tagName: string;
    publishedAt: string;
    htmlUrl: string;
    body: string;
    asset: {
        name: string;
        size: number;
        downloadUrl: string;
    };
};
