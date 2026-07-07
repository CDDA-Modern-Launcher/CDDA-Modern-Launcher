import { ChildProcess, spawn } from "node:child_process";

export async function runCommand(command: string, args: string[]): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const child: ChildProcess = spawn(command, args, { stdio: "ignore" });
        child.on("error", reject);
        child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code ?? "unknown"}.`))));
    });
}
