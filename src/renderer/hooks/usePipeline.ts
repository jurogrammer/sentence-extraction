import { useState, useEffect, useCallback, useRef } from 'react'
import type { PipelineOptions, PipelineProgress, PipelineResult } from '../../shared/types'

type Status = 'idle' | 'running' | 'complete' | 'error'

export function usePipeline() {
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<PipelineProgress | null>(null)
  const [result, setResult] = useState<PipelineResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cleanups = useRef<(() => void)[]>([])

  useEffect(() => {
    const c1 = window.api.pipeline.onProgress((p) => setProgress(p))
    const c2 = window.api.pipeline.onComplete((r) => {
      setResult(r)
      setStatus('complete')
    })
    const c3 = window.api.pipeline.onError((e) => {
      setError(e)
      setStatus('error')
    })
    cleanups.current = [c1, c2, c3]
    return () => cleanups.current.forEach((fn) => fn())
  }, [])

  const start = useCallback(async (options: PipelineOptions) => {
    setStatus('running')
    setProgress(null)
    setResult(null)
    setError(null)
    await window.api.pipeline.start(options)
  }, [])

  const cancel = useCallback(async () => {
    await window.api.pipeline.cancel()
    setStatus('idle')
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setProgress(null)
    setResult(null)
    setError(null)
  }, [])

  return { status, progress, result, error, start, cancel, reset }
}
