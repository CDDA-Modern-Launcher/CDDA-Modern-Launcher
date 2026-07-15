import * as fs from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";

import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

export type ClonedMod = {
    branch: string;
    commit: string;
};

export type ModGitState = {
    localCommit: string;
    remoteCommit: string;
    hasUnpushedCommits: boolean;
    updateAvailable: boolean;
};

export class ModGitService {
    async clone(sourceUrl: string, targetPath: string, branch?: string): Promise<ClonedMod> {
        await rm(targetPath, { recursive: true, force: true });
        await mkdir(targetPath, { recursive: true });
        await git.clone({ fs, http, dir: targetPath, url: sourceUrl, ref: branch, singleBranch: true, depth: 1 });

        return {
            branch: (await git.currentBranch({ fs, dir: targetPath, fullname: false })) ?? branch ?? "master",
            commit: await git.resolveRef({ fs, dir: targetPath, ref: "HEAD" })
        };
    }

    async replaceDirectory(sourcePath: string, targetPath: string): Promise<void> {
        await rm(targetPath, { recursive: true, force: true });
        await mkdir(dirname(targetPath), { recursive: true });
        await fs.promises.rename(sourcePath, targetPath);
    }

    async hasLocalChanges(modPath: string): Promise<boolean> {
        const matrix = await git.statusMatrix({ fs, dir: modPath });
        return matrix.some((row) => row[1] !== row[2] || row[1] !== row[3]);
    }

    async hasUnpushedCommits(modPath: string, trackingRef?: string): Promise<boolean> {
        if (!trackingRef) return false;
        const localCommit = await git.resolveRef({ fs, dir: modPath, ref: "HEAD" });
        const remoteCommit = await git.resolveRef({ fs, dir: modPath, ref: trackingRef });
        return (await this.compareCommits(modPath, localCommit, remoteCommit)).hasUnpushedCommits;
    }

    async fetchState(modPath: string, branch: string, trackingRef: string): Promise<ModGitState> {
        await git.fetch({ fs, http, dir: modPath, remote: "origin", ref: branch, singleBranch: true, depth: 100 });
        const localCommit = await git.resolveRef({ fs, dir: modPath, ref: "HEAD" });
        const remoteCommit = await git.resolveRef({ fs, dir: modPath, ref: trackingRef });
        return {
            localCommit,
            remoteCommit,
            ...(await this.compareCommits(modPath, localCommit, remoteCommit))
        };
    }

    private async compareCommits(modPath: string, localCommit: string, remoteCommit: string): Promise<Pick<ModGitState, "hasUnpushedCommits" | "updateAvailable">> {
        if (localCommit === remoteCommit) return { hasUnpushedCommits: false, updateAvailable: false };

        const remoteContainsLocal = await this.isDescendent(modPath, remoteCommit, localCommit);
        const localContainsRemote = await this.isDescendent(modPath, localCommit, remoteCommit);

        return {
            hasUnpushedCommits: !remoteContainsLocal,
            updateAvailable: !localContainsRemote
        };
    }

    private async isDescendent(modPath: string, commit: string, ancestor: string): Promise<boolean> {
        try {
            return await git.isDescendent({ fs, dir: modPath, oid: commit, ancestor, depth: -1 });
        } catch {
            return false;
        }
    }
}

export const modGitService = new ModGitService();
