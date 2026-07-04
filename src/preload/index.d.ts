import { ElectronAPI } from '@electron-toolkit/preload'

import { AppAppearance } from '../shared/appearance'
import { LocalizationBundle } from '../shared/localization'
import { RepositoryStatus, SelectRepositoryResult } from '../shared/repository'

type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; version: string }
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'not-available'; version?: string }
  | { status: 'skipped'; version: string }
  | { status: 'error'; message: string; messageKey?: string }

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


type LocalizationApi = {
  getBundle: () => Promise<LocalizationBundle>
  setLocale: (locale: string) => Promise<LocalizationBundle>
  onChanged: (callback: (bundle: LocalizationBundle) => void) => () => void
}

type AppearanceApi = {
  get: () => Promise<AppAppearance>
  onChanged: (callback: (appearance: AppAppearance) => void) => () => void
}

type AppApi = {
  updater: UpdaterApi
  repository: RepositoryApi
  localization: LocalizationApi
  appearance: AppearanceApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApi
  }
}
