import { ElectronAPI } from '@electron-toolkit/preload'
import { AppAppearance } from '../shared/appearance'
import { RepositoryStatus, SelectRepositoryResult } from '../shared/repository'

type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; version: string }
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'not-available'; version?: string }
  | { status: 'skipped'; version: string }
  | { status: 'error'; message: string }

type UpdaterApi = {
  getState: () => Promise<UpdateState>
  checkNow: () => Promise<UpdateState>
  installNow: () => Promise<boolean>
  dismiss: () => Promise<UpdateState>
  skipVersion: (version: string) => Promise<UpdateState>
  showMockDownloadedUpdate: (version?: string) => Promise<UpdateState>
  onStateChanged: (callback: (state: UpdateState) => void) => () => void
}

type RepositoryApi = {
  getStatus: () => Promise<RepositoryStatus>
  selectFolder: () => Promise<SelectRepositoryResult>
}

type AppearanceApi = {
  get: () => Promise<AppAppearance>
  onChanged: (callback: (appearance: AppAppearance) => void) => () => void
}

type AppApi = {
  updater: UpdaterApi
  repository: RepositoryApi
  appearance: AppearanceApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApi
  }
}
