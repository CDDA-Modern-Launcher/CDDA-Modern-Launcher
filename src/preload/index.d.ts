import { ElectronAPI } from '@electron-toolkit/preload'

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

type AppApi = {
  updater: UpdaterApi
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApi
  }
}
