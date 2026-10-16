'use client'
import { useCallback, useState } from 'react'
import { AlertTriangle, Trash2, LogOut } from 'lucide-react'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...opts, resolve })
    })
  }, [])

  const handleConfirm = () => {
    state?.resolve(true)
    setState(null)
  }

  const handleCancel = () => {
    state?.resolve(false)
    setState(null)
  }

  const dialog = state ? (
    <ConfirmDialogUI
      {...state}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null

  return { confirm, dialog }
}

interface ConfirmDialogUIProps extends ConfirmOptions {
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialogUI({
  title,
  message,
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogUIProps) {
  const variantMap = {
    danger: {
      iconWrap: 'bg-red-500/15 border border-red-500/20',
      icon: <Trash2 className="w-5 h-5 text-red-400" />,
      confirmCls: 'bg-red-500 hover:bg-red-600 shadow-red-500/20',
    },
    warning: {
      iconWrap: 'bg-yellow-500/15 border border-yellow-500/20',
      icon: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
      confirmCls: 'bg-yellow-500 hover:bg-yellow-600 shadow-yellow-500/20',
    },
    default: {
      iconWrap: 'bg-blue-500/15 border border-blue-500/20',
      icon: <LogOut className="w-5 h-5 text-blue-400" />,
      confirmCls: 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20',
    },
  }
  const { iconWrap, icon, confirmCls } = variantMap[variant]

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: '1px solid rgba(148,163,184,0.12)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent bar */}
        <div className={`h-1 w-full ${variant === 'danger' ? 'bg-gradient-to-r from-red-500 to-rose-500' : variant === 'warning' ? 'bg-gradient-to-r from-yellow-500 to-amber-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`} />

        <div className="p-6 space-y-5">
          {/* Icon + Title */}
          <div className="flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconWrap}`}>
              {icon}
            </div>
            <div className="pt-0.5">
              <h3 className="text-white font-semibold text-base leading-snug">{title}</h3>
              {message && (
                <p className="text-slate-400 text-sm mt-1 leading-relaxed">{message}</p>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2.5 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl text-slate-300 hover:text-white text-sm font-medium transition-all border border-slate-700/60 hover:bg-slate-700/50"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-all shadow-lg ${confirmCls}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
