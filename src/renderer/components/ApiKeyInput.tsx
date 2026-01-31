import { useState, useEffect } from 'react'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
}

export default function ApiKeyInput({ label, value, onChange }: Props) {
  const [status, setStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!value) {
      setStatus('idle')
      setMessage('')
      return
    }

    setStatus('validating')
    const timer = setTimeout(async () => {
      try {
        const isValid = await window.api.openai.validateKey(value)
        setStatus(isValid ? 'valid' : 'invalid')
        setMessage(isValid ? '' : 'Invalid API Key')
      } catch (error) {
        setStatus('invalid')
        setMessage('Validation failed')
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [value])

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-3 py-2 pr-10 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${
            status === 'invalid'
              ? 'border-red-300 focus:ring-red-500'
              : status === 'valid'
              ? 'border-green-300 focus:ring-green-500'
              : 'border-gray-300 focus:ring-blue-500'
          }`}
          placeholder="sk-..."
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
          {status === 'validating' && (
            <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {status === 'valid' && (
            <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {status === 'invalid' && (
            <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
      </div>
      {message && <p className="text-xs text-red-500 mt-1">{message}</p>}
    </div>
  )
}
