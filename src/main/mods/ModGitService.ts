import * as fs from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";

import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

export type ClonedMod = {
    branch: string;
    commit: string;
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

    async fetchState(modPath: string, branch: string, trackingRef: string): Promise<{ localCommit: string; remoteCommit: string }> {
        await git.fetch({ fs, http, dir: modPath, remote: "origin", ref: branch, singleBranch: true, depth: 1 });
        return {
            localCommit: await git.resolveRef({ fs, dir: modPath, ref: "HEAD" }),
            remoteCommit: await git.resolveRef({ fs, dir: modPath, ref: trackingRef })
        };
    }
}

export const modGitService = new ModGitService();
