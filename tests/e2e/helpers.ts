import { _electron as electron, Page, BrowserContext } from '@playwright/test'
import { join } from 'path'

export interface ElectronAppContext {
  electronApp: Awaited<ReturnType<typeof electron.launch>>
  window: Page | null
  context: BrowserContext
}

export async function launchElectronApp(): Promise<ElectronAppContext> {
  const electronApp = await electron.launch({
    args: [join(__dirname, '../../out/main/index.js')],
  })

  const context = await electronApp.context()
  let window: Page | null = null

  const pages = electronApp.windows()
  if (pages.length > 0) {
    window = pages[0]
  }

  return { electronApp, window, context }
}

export async function waitForWindow(
  electronApp: Awaited<ReturnType<typeof electron.launch>>,
  timeout: number = 10000
): Promise<Page> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const pages = electronApp.windows()
    if (pages.length > 0) {
      return pages[0]
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error(`Window did not appear within ${timeout}ms`)
}

export async function closeElectronApp(
  electronApp: Awaited<ReturnType<typeof electron.launch>>
): Promise<void> {
  await electronApp.close()
}
