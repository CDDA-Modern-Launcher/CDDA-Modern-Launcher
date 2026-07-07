export function isAutoBackupInCooldown(latestBackupAt: number | null, cooldownMs: number): boolean {
    return cooldownMs > 0 && latestBackupAt !== null && Date.now() - latestBackupAt < cooldownMs;
}
