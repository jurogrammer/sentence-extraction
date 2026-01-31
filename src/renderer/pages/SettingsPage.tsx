import { useTranslation } from 'react-i18next'
import { useSettings } from '../hooks/useSettings'
import ProviderSelector from '../components/ProviderSelector'
import LanguageSwitch from '../components/LanguageSwitch'

export default function SettingsPage() {
  const { t } = useTranslation()
  const { settings, loading, update } = useSettings()

  if (loading) return <div className="text-gray-400">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h2 className="text-2xl font-bold text-gray-800">{t('settings.title')}</h2>

      {/* UI Language */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">{t('settings.uiLanguage')}</label>
        <LanguageSwitch value={settings.uiLanguage} onChange={(v) => update('uiLanguage', v)} />
      </div>

      {/* AI Provider */}
      <ProviderSelector
        label={t('settings.aiProvider')}
        value={settings.aiProvider}
        options={[
          { value: 'openai', label: 'OpenAI' },
          { value: 'ollama', label: 'Ollama' }
        ]}
        onChange={(v) => update('aiProvider', v as 'openai' | 'ollama')}
      />

      {/* OpenAI settings */}
      {settings.aiProvider === 'openai' && (
        <div className="space-y-4 pl-4 border-l-2 border-blue-200">
          <Field
            label={t('settings.openaiApiKey')}
            type="password"
            value={settings.openaiApiKey}
            onChange={(v) => update('openaiApiKey', v)}
          />
          <Field
            label={t('settings.openaiModel')}
            value={settings.openaiModel}
            onChange={(v) => update('openaiModel', v)}
          />
        </div>
      )}

      {/* Ollama settings */}
      {settings.aiProvider === 'ollama' && (
        <div className="space-y-4 pl-4 border-l-2 border-blue-200">
          <Field
            label={t('settings.ollamaUrl')}
            value={settings.ollamaUrl}
            onChange={(v) => update('ollamaUrl', v)}
          />
          <Field
            label={t('settings.ollamaModel')}
            value={settings.ollamaModel}
            onChange={(v) => update('ollamaModel', v)}
          />
        </div>
      )}

      {/* Whisper Mode */}
      <ProviderSelector
        label={t('settings.whisperMode')}
        value={settings.whisperMode}
        options={[
          { value: 'cloud', label: t('settings.whisperCloud') },
          { value: 'local', label: t('settings.whisperLocal') }
        ]}
        onChange={(v) => update('whisperMode', v as 'local' | 'cloud')}
      />

      {settings.whisperMode === 'local' && (
        <div className="pl-4 border-l-2 border-blue-200">
          <Field
            label={t('settings.whisperModelSize')}
            value={settings.whisperModelSize}
            onChange={(v) => update('whisperModelSize', v)}
          />
        </div>
      )}

      {/* Languages */}
      <div className="grid grid-cols-2 gap-4">
        <Field
          label={t('settings.targetLanguage')}
          value={settings.targetLanguage}
          onChange={(v) => update('targetLanguage', v)}
        />
        <Field
          label={t('settings.nativeLanguage')}
          value={settings.nativeLanguage}
          onChange={(v) => update('nativeLanguage', v)}
        />
      </div>

      {/* Audio Padding */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">{t('settings.audioPadding')}</label>
        <input
          type="number"
          value={settings.audioPaddingMs}
          onChange={(e) => update('audioPaddingMs', Number(e.target.value))}
          className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Max Cards */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">{t('settings.maxCards')}</label>
        <input
          type="number"
          value={settings.maxCards}
          onChange={(e) => update('maxCards', Number(e.target.value))}
          className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Debug Mode */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={settings.debugMode}
          onChange={(e) => update('debugMode', e.target.checked)}
          className="rounded border-gray-300"
        />
        <span className="text-sm text-gray-700">{t('settings.debugMode')}</span>
      </label>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text'
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}
