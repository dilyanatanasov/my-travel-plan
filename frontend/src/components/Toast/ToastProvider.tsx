import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ToastTone = 'neutral' | 'success' | 'error';

interface ToastAction {
  label: string;
  onAction: () => void | Promise<void>;
}

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
}

interface ShowToastOptions {
  tone?: ToastTone;
  action?: ToastAction;
  /** Milliseconds before auto-dismiss. Undo toasts get longer by default. */
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (message: string, options?: ShowToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 4000;
const ACTION_DURATION = 8000;

/**
 * Minimal toast system.
 *
 * Exists mainly so destructive actions can offer undo: removing a country used
 * to delete its date, notes and visit type with no confirmation and no way
 * back, which on a phone is one mis-tap away at all times.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, options: ShowToastOptions = {}) => {
      const id = nextId.current++;
      const duration =
        options.durationMs ??
        (options.action ? ACTION_DURATION : DEFAULT_DURATION);

      setToasts((current) => [
        ...current,
        { id, message, tone: options.tone ?? 'neutral', action: options.action },
      ]);

      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration)
      );
    },
    [dismiss]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        // aria-live so the message is announced; the region itself must exist
        // in the DOM before the toast appears for that to work reliably.
        aria-live="polite"
        aria-atomic="false"
        className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 pointer-events-none sm:items-end sm:pr-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto w-full sm:w-auto sm:min-w-[20rem] max-w-md flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg text-sm text-white ${
              toast.tone === 'error'
                ? 'bg-red-600'
                : toast.tone === 'success'
                  ? 'bg-brand-700'
                  : 'bg-slate-800'
            }`}
          >
            <span className="flex-1">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={async () => {
                  dismiss(toast.id);
                  await toast.action?.onAction();
                }}
                className="flex-shrink-0 min-h-9 px-3 rounded-lg font-semibold underline underline-offset-2 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/70"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="flex-shrink-0 p-1 rounded hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside a ToastProvider');
  }
  return context;
}
