import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { usePipeline } from '../hooks/usePipeline'
import UrlInput from '../components/UrlInput'
import FileUpload from '../components/FileUpload'
import ProgressLog from '../components/ProgressLog'

export default function MainPage() {
  const { t } = useTranslation()
  const { status, progress, result, error, start, cancel, reset } = usePipeline()
  const [url, setUrl] = useState('')
  const [filePath, setFilePath] = useState<string | null>(null)

  const running = status === 'running'

  const handleStart = useCallback(() => {
    if (url.trim()) {
      start({ inputType: 'url', input: url.trim() })
    } else if (filePath) {
      start({ inputType: 'file', input: filePath })
    }
  }, [url, filePath, start])

  const handleSave = useCallback(async () => {
    if (!result) return
    const savePath = await window.api.dialog.saveFile('anki-cards.apkg')
    if (savePath) {
      await window.api.file.copy(result.apkgPath, savePath)
    }
  }, [result])

  const canStart = !running && (url.trim() || filePath)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">{t('main.title')}</h2>
      <p className="text-gray-500">{t('main.description')}</p>

      <div className="space-y-4">
        <UrlInput value={url} onChange={setUrl} disabled={running} />
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{t('main.orUpload')}</span>
          <FileUpload filePath={filePath} onSelect={setFilePath} disabled={running} />
        </div>
      </div>

      <div className="flex gap-3">
        {status === 'idle' || status === 'error' ? (
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t('main.start')}
          </button>
        ) : status === 'running' ? (
          <button
            onClick={cancel}
            className="px-6 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
          >
            {t('main.cancel')}
          </button>
        ) : null}

        {status === 'complete' && (
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            {t('main.start')}
          </button>
        )}
      </div>

      {running && <ProgressLog progress={progress} />}

      {status === 'complete' && result && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
          <p className="text-green-700 font-medium">{t('main.complete')}</p>
          <p className="text-green-600 text-sm">
            {t('main.cardsCreated', { count: result.cardCount })}
          </p>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            {t('main.save')}
          </button>
        </div>
      )}

      {status === 'error' && error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}
