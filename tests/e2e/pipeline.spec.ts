import { test, expect } from '@playwright/test'
import { launchElectronApp, closeElectronApp, type ElectronAppContext } from './helpers'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'

test.describe('Pipeline E2E Tests', () => {
  let app: ElectronAppContext

  test.beforeAll(async () => {
    const { execSync } = await import('child_process')
    execSync('npm run build', { cwd: join(__dirname, '../..'), stdio: 'inherit' })
  })

  test.beforeEach(async () => {
    app = await launchElectronApp()
    await app.window?.waitForLoadState('domcontentloaded')
  })

  test.afterEach(async () => {
    if (app.electronApp) {
      await closeElectronApp(app.electronApp)
    }
  })

  test('OpenAI integration - API key setup and pipeline execution', async () => {
    const window = app.window
    if (!window) throw new Error('Window not found')

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      test.skip()
      return
    }

    const testFile = '/Users/user/Downloads/getvid.mp4'

    await app.electronApp.evaluate(
      ({ ipcMain }, mockFilePath) => {
        ipcMain.removeHandler('dialog:openFile')
        ipcMain.handle('dialog:openFile', async () => mockFilePath)
      },
      testFile
    )

    await window.click('a[href="/settings"]')
    await window.waitForSelector('h2:has-text("설정")', { timeout: 5000 })

    const openaiRadio = window.locator('input[type="radio"][value="openai"]')
    await openaiRadio.click()

    const apiKeyInput = window.locator('input[type="password"][placeholder="sk-..."]')
    await apiKeyInput.fill(apiKey)

    await window.waitForSelector('svg.text-green-500', { timeout: 10000 })

    await window.click('a[href="/"]')
    await window.waitForSelector('h2:has-text("Anki")', { timeout: 5000 })

    const selectFileButton = window.locator('button:has-text("파일 선택")')
    await expect(selectFileButton).toBeVisible()
    await selectFileButton.click()

    await window.waitForSelector(`span.text-gray-500:has-text("getvid.mp4")`, { timeout: 5000 })

    const startButton = window.locator('button:has-text("시작")')
    await startButton.click()

    await window.waitForSelector('p.text-green-700:has-text("완료")', { timeout: 5 * 60 * 1000 })

    const cardCountText = await window.locator('p.text-green-600').textContent()
    expect(cardCountText).toMatch(/\d+/)
    const cardCount = parseInt(cardCountText?.match(/\d+/)?.[0] || '0')
    expect(cardCount).toBeGreaterThan(0)
  })

  test('YouTube download - URL input and progress tracking', async () => {
    const window = app.window
    if (!window) throw new Error('Window not found')

    await window.waitForSelector('h2:has-text("Anki")', { timeout: 5000 })

    const urlInput = window.locator('input[type="url"]')
    await urlInput.fill('https://www.youtube.com/watch?v=glFrp-CmNVA&list=PLdVY0007sCPWPFaTE-Y2UVZiDc0iGkYLT')

    const startButton = window.locator('button:has-text("시작")')
    await startButton.click()

    await window.waitForSelector('div.space-y-2', { timeout: 10000 })

    const progressItem = window.locator('div.flex.items-start.gap-2')
    await expect(progressItem.first()).toBeVisible()

    const cancelButton = window.locator('button:has-text("취소")')
    await cancelButton.click()

    await window.waitForTimeout(2000)
  })

  test('File upload - local file selection and path display', async () => {
    const window = app.window
    if (!window) throw new Error('Window not found')

    const testFile = '/Users/user/Downloads/getvid.mp4'

    await app.electronApp.evaluate(
      ({ ipcMain }, mockFilePath) => {
        ipcMain.removeHandler('dialog:openFile')
        ipcMain.handle('dialog:openFile', async () => mockFilePath)
      },
      testFile
    )

    await window.waitForSelector('h2:has-text("Anki")', { timeout: 5000 })

    const selectFileButton = window.locator('button:has-text("파일 선택")')
    await selectFileButton.click()

    await window.waitForSelector('span.text-gray-500:has-text("getvid.mp4")', { timeout: 5000 })

    const fileNameSpan = window.locator('span.text-gray-500').first()
    const fileName = await fileNameSpan.textContent()
    expect(fileName).toBe('getvid.mp4')
  })

  test('Subtitle upload - subtitle file selection and path display', async () => {
    const window = app.window
    if (!window) throw new Error('Window not found')

    const srtContent = `1
00:00:00,000 --> 00:00:05,000
Hello, this is a test subtitle.

2
00:00:05,000 --> 00:00:10,000
This is the second line.
`
    const tempSrtPath = join(__dirname, 'temp-test-subtitle.srt')
    writeFileSync(tempSrtPath, srtContent, 'utf-8')

    try {
      const testFile = '/Users/user/Downloads/getvid.mp4'

      await app.electronApp.evaluate(
        ({ ipcMain }, { subtitle, video }) => {
          ipcMain.removeHandler('dialog:openSubtitleFile')
          ipcMain.handle('dialog:openSubtitleFile', async () => subtitle)
          ipcMain.removeHandler('dialog:openFile')
          ipcMain.handle('dialog:openFile', async () => video)
        },
        { subtitle: tempSrtPath, video: testFile }
      )

      await window.waitForSelector('h2:has-text("Anki")', { timeout: 5000 })

      const selectSubtitleButton = window.locator('button:has-text("자막 선택")')
      await selectSubtitleButton.click()

      await window.waitForSelector('span.text-gray-500:has-text("temp-test-subtitle.srt")', {
        timeout: 5000
      })

      const subtitleSpan = window.locator('span.text-gray-500').nth(1)
      const subtitleText = await subtitleSpan.textContent()
      expect(subtitleText).toContain('temp-test-subtitle.srt')

      const selectFileButton = window.locator('button:has-text("파일 선택")')
      await selectFileButton.click()

      await window.waitForSelector('span.text-gray-500:has-text("getvid.mp4")', { timeout: 5000 })

      const startButton = window.locator('button:has-text("시작")')
      await expect(startButton).toBeEnabled()

      await startButton.click()

      await window.waitForSelector('div.space-y-2', { timeout: 10000 })

      const cancelButton = window.locator('button:has-text("취소")')
      await cancelButton.click()

      await window.waitForTimeout(1000)
    } finally {
      try {
        unlinkSync(tempSrtPath)
      } catch (err) {}
    }
  })
})
