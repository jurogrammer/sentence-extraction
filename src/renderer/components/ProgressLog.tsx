import type { PipelineProgress } from '../../shared/types'

interface Props {
  progress: PipelineProgress | null
}

export default function ProgressLog({ progress }: Props) {
  if (!progress) return null

  const percent = Math.round(progress.percent * 100)

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-gray-600">
        <span>{progress.message}</span>
        <span>{percent}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
