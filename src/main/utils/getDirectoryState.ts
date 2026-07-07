import { access, mkdir, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { isNodeError } from "./isNodeError";

type DirectoryState = { status: "ok"; isEmpty: boolean } | { status: "missing" } | { status: "not-directory" };

export async function getDirectoryState(path: string): Promise<DirectoryState> {
    try {
        await access(path, constants.F_OK);
    } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") {
            return { status: "missing" };
        }

        throw error;
    }

    try {
        await mkdir(path, { recursive: false });
    } catch (error) {
        if (isNodeError(error) && error.code === "EEXIST") {
            // The path exists. readdir below is the portable directory check.
        } else {
            throw error;
        }
    }

    try {
        const entries = await readdir(path);
        return { status: "ok", isEmpty: entries.length === 0 };
    } catch (error) {
        if (isNodeError(error) && (error.code === "ENOTDIR" || error.code === "EINVAL")) {
            return { status: "not-directory" };
        }

        throw error;
    }
}
