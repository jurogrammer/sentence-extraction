import { useTranslation } from 'react-i18next'

interface Props {
  value: 'ko' | 'en'
  onChange: (lang: 'ko' | 'en') => void
}

export default function LanguageSwitch({ value, onChange }: Props) {
  const { i18n } = useTranslation()

  const handleChange = (lang: 'ko' | 'en') => {
    onChange(lang)
    i18n.changeLanguage(lang)
  }

  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
      {(['ko', 'en'] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => handleChange(lang)}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            value === lang
              ? 'bg-white text-gray-800 shadow-sm font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {lang === 'ko' ? '한국어' : 'English'}
        </button>
      ))}
    </div>
  )
}
