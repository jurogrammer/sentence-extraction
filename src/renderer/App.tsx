import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MainPage from './pages/MainPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  const { t, i18n } = useTranslation()

  useEffect(() => {
    window.api.settings.get('uiLanguage').then((lang) => {
      if (lang) i18n.changeLanguage(lang)
    })
  }, [i18n])

  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen bg-gray-50">
        <nav className="flex items-center gap-4 px-6 py-3 bg-white border-b border-gray-200 drag-region">
          <h1 className="text-lg font-bold text-gray-800 mr-4">Anki Generator</h1>
          <NavLink
            to="/"
            className={({ isActive }) =>
              `px-3 py-1 rounded text-sm no-drag ${isActive ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:text-gray-800'}`
            }
          >
            {t('nav.main')}
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `px-3 py-1 rounded text-sm no-drag ${isActive ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-600 hover:text-gray-800'}`
            }
          >
            {t('nav.settings')}
          </NavLink>
        </nav>
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
