import { BrowserWindow, dialog, ipcMain } from 'electron'
import { LocalRepositoryService } from './LocalRepositoryService'
import { SelectRepositoryResult } from '../../shared/repository'

export function setupRepositoryIpc(repositoryService: LocalRepositoryService): void {
  ipcMain.handle('repository:get-status', () => repositoryService.getInitialStatus())

  ipcMain.handle('repository:select-folder', async (event): Promise<SelectRepositoryResult> => {
    const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const options = {
      title: 'Select CDDA launcher repository folder',
      properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'>
    }
    const result = owner === undefined ? await dialog.showOpenDialog(options) : await dialog.showOpenDialog(owner, options)

    if (result.canceled || result.filePaths.length === 0) {
      return { status: 'cancelled' }
    }

    return {
      status: 'selected',
      repository: await repositoryService.useRepository(result.filePaths[0])
    }
  })
}
