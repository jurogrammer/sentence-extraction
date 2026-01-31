import { useTranslation } from 'react-i18next'

interface Props {
  filePath: string | null
  onSelect: (path: string) => void
  disabled?: boolean
}

export default function FileUpload({ filePath, onSelect, disabled }: Props) {
  const { t } = useTranslation()

  const handleClick = async () => {
    const path = await window.api.dialog.openFile()
    if (path) onSelect(path)
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={disabled}
        className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50 transition-colors"
      >
        {t('main.selectFile')}
      </button>
      {filePath && (
        <span className="text-sm text-gray-500 truncate max-w-xs">{filePath.split('/').pop()}</span>
      )}
    </div>
  )
}
