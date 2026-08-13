import { useStore } from '../store/useStore.js';

/** Toast messages, top-right. */
export default function ToastTray() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  if (!toasts.length) return null;
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className="toast show" onClick={() => dismiss(t.id)}>
          <i className={`fa-solid ${t.kind === 'warn' ? 'fa-triangle-exclamation' : t.kind === 'host' ? 'fa-crown' : 'fa-heart'}`} />
          {t.msg}
        </div>
      ))}
    </div>
  );
}