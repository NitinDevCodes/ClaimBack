import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, X, AlertCircle } from 'lucide-react';

const ToastContext = createContext(null);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Set());
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const dismiss = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const notify = useCallback((message, type = 'success') => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current.slice(-3), { id, message, type }]);
    const timer = setTimeout(() => { dismiss(id); timers.current.delete(timer); }, 6000);
    timers.current.add(timer);
  }, [dismiss]);
  return <ToastContext.Provider value={notify}>
    {children}
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => <div className={`toast ${toast.type}`} key={toast.id} role="status">
        {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
        <span>{toast.message}</span><button onClick={() => dismiss(toast.id)} aria-label="Dismiss notification"><X size={16} /></button>
      </div>)}
    </div>
  </ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);
