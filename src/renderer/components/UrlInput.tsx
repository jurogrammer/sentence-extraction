import { useTranslation } from 'react-i18next'

interface Props {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export default function UrlInput({ value, onChange, disabled }: Props) {
  const { t } = useTranslation()

  return (
    <input
      type="url"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t('main.urlPlaceholder')}
      disabled={disabled}
      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-50"
    />
  )
}
