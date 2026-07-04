import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'
import {
  REPOSITORY_CONFIG_FILE_NAME,
  RepositoryConfig,
  RepositoryStatus
} from '../../shared/repository'
import { LauncherSettingsStore } from '../settings/LauncherSettingsStore'
import { parseJsonc } from './jsonc'

export class LocalRepositoryService {
  constructor(private readonly settingsStore: LauncherSettingsStore) {}

  async getInitialStatus(): Promise<RepositoryStatus> {
    const repositoryPath = await this.settingsStore.getRepositoryPath()

    if (repositoryPath === null) {
      return { status: 'unconfigured' }
    }

    return this.validate(repositoryPath)
  }

  async useRepository(repositoryPath: string): Promise<RepositoryStatus> {
    const status = await this.prepare(repositoryPath)

    if (status.status === 'ready') {
      await this.settingsStore.setRepositoryPath(repositoryPath)
    }

    return status
  }

  private async prepare(repositoryPath: string): Promise<RepositoryStatus> {
    const directoryState = await getDirectoryState(repositoryPath)

    if (directoryState.status === 'missing') {
      return { status: 'invalid', path: repositoryPath, message: 'Selected folder does not exist.' }
    }

    if (directoryState.status === 'not-directory') {
      return { status: 'invalid', path: repositoryPath, message: 'Selected path is not a folder.' }
    }

    const configPath = join(repositoryPath, REPOSITORY_CONFIG_FILE_NAME)
    const existingConfig = await this.readConfig(configPath)

    if (existingConfig.status === 'ok') {
      return { status: 'ready', path: repositoryPath, config: existingConfig.config }
    }

    if (!directoryState.isEmpty) {
      return {
        status: 'invalid',
        path: repositoryPath,
        message:
          existingConfig.status === 'missing'
            ? `Folder is not empty and ${REPOSITORY_CONFIG_FILE_NAME} was not found.`
            : `${REPOSITORY_CONFIG_FILE_NAME} exists but is not valid.`
      }
    }

    const config: RepositoryConfig = {
      schemaVersion: 1,
      createdAt: new Date().toISOString()
    }

    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
    return { status: 'ready', path: repositoryPath, config }
  }

  private async validate(repositoryPath: string): Promise<RepositoryStatus> {
    const directoryState = await getDirectoryState(repositoryPath)

    if (directoryState.status === 'missing') {
      return {
        status: 'invalid',
        path: repositoryPath,
        message: 'Saved repository folder does not exist.'
      }
    }

    if (directoryState.status === 'not-directory') {
      return {
        status: 'invalid',
        path: repositoryPath,
        message: 'Saved repository path is not a folder.'
      }
    }

    const config = await this.readConfig(join(repositoryPath, REPOSITORY_CONFIG_FILE_NAME))

    if (config.status === 'ok') {
      return { status: 'ready', path: repositoryPath, config: config.config }
    }

    return {
      status: 'invalid',
      path: repositoryPath,
      message:
        config.status === 'missing'
          ? `Saved repository folder does not contain ${REPOSITORY_CONFIG_FILE_NAME}.`
          : `Saved repository folder contains invalid ${REPOSITORY_CONFIG_FILE_NAME}.`
    }
  }

  private async readConfig(
    configPath: string
  ): Promise<
    { status: 'ok'; config: RepositoryConfig } | { status: 'missing' } | { status: 'invalid' }
  > {
    try {
      const content = await readFile(configPath, 'utf8')
      const parsed = parseJsonc(content)

      if (!isRepositoryConfig(parsed)) {
        return { status: 'invalid' }
      }

      return { status: 'ok', config: parsed }
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return { status: 'missing' }
      }

      console.error('[repository] failed to read repository config', error)
      return { status: 'invalid' }
    }
  }
}

type DirectoryState =
  { status: 'ok'; isEmpty: boolean } | { status: 'missing' } | { status: 'not-directory' }

async function getDirectoryState(path: string): Promise<DirectoryState> {
  try {
    await access(path, constants.F_OK)
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return { status: 'missing' }
    }

    throw error
  }

  try {
    await mkdir(path, { recursive: false })
  } catch (error) {
    if (isNodeError(error) && error.code === 'EEXIST') {
      // The path exists. readdir below is the portable directory check.
    } else {
      throw error
    }
  }

  try {
    const entries = await readdir(path)
    return { status: 'ok', isEmpty: entries.length === 0 }
  } catch (error) {
    if (isNodeError(error) && (error.code === 'ENOTDIR' || error.code === 'EINVAL')) {
      return { status: 'not-directory' }
    }

    throw error
  }
}

function isRepositoryConfig(value: unknown): value is RepositoryConfig {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Partial<RepositoryConfig>
  return candidate.schemaVersion === 1 && typeof candidate.createdAt === 'string'
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}
