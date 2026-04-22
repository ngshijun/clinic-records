import { reactive } from 'vue'

export type DialogKind = 'alert' | 'confirm' | 'prompt'
export type DialogVariant = 'default' | 'danger'

interface BaseRequest {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: DialogVariant
}

interface PromptOptions extends BaseRequest {
  defaultValue?: string
  placeholder?: string
}

interface DialogEntry {
  kind: DialogKind
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  variant: DialogVariant
  defaultValue?: string
  placeholder?: string
  resolve: (value: unknown) => void
}

const state = reactive<{ queue: DialogEntry[] }>({ queue: [] })

function push<T>(entry: Omit<DialogEntry, 'resolve'>): Promise<T> {
  return new Promise<T>((resolve) => {
    state.queue.push({ ...entry, resolve: resolve as (v: unknown) => void })
  })
}

export function useDialog() {
  function confirm(opts: BaseRequest): Promise<boolean> {
    return push<boolean>({ kind: 'confirm', variant: opts.variant ?? 'default', ...opts })
  }

  function prompt(opts: PromptOptions): Promise<string | null> {
    return push<string | null>({ kind: 'prompt', variant: opts.variant ?? 'default', ...opts })
  }

  function alert(opts: BaseRequest): Promise<void> {
    return push<void>({ kind: 'alert', variant: opts.variant ?? 'default', ...opts })
  }

  return { confirm, prompt, alert, state }
}
