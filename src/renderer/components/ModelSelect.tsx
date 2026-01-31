import { useState, useEffect } from 'react'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  apiKey: string
}

export default function ModelSelect({ label, value, onChange, apiKey }: Props) {
  const [models, setModels] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!apiKey) {
      setModels([])
      return
    }

    const fetchModels = async () => {
      setLoading(true)
      setError('')
      try {
        const list = await window.api.openai.listModels()
        // Filter for GPT models only as requested
        const gptModels = list.filter(m => m.toLowerCase().includes('gpt'))
        setModels(gptModels)
      } catch (err) {
        console.error('Failed to fetch models:', err)
        setError('Failed to load models')
      } finally {
        setLoading(false)
      }
    }

    // Debounce fetching to wait for user to finish typing key
    // and for the key to be saved/validated
    const timer = setTimeout(fetchModels, 1000)
    return () => clearTimeout(timer)
  }, [apiKey])

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={loading || !apiKey}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500 appearance-none bg-white"
        >
          {loading ? (
            <option>Loading models...</option>
          ) : models.length > 0 ? (
            <>
              <option value="" disabled>Select a model</option>
              {models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
              {!models.includes(value) && value && (
                <option value={value}>{value}</option>
              )}
            </>
          ) : (
            <option value={value}>{value || 'Enter API key to load models'}</option>
          )}
        </select>
        {/* Custom arrow to ensure consistent look, though native select is used */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
          {loading ? (
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
