// Generic modal with backdrop + close-on-Escape + close-on-backdrop-click.
// Usage:
//   const open = useSignal(false);
//   <Modal open={open.value} onClose={() => open.value = false} title="Conferma">
//     <p>Sei sicuro?</p>
//   </Modal>

import { useEffect } from 'preact/hooks';
import s from './Modal.module.css';

export function Modal({ open, onClose, title, children, footer, dismissable = true, size = 'md' }) {
  useEffect(() => {
    if (!open || !dismissable) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismissable, onClose]);

  if (!open) return null;

  const onBackdropClick = (e) => {
    if (dismissable && e.target === e.currentTarget) onClose?.();
  };

  return (
    <div class={s.backdrop} onClick={onBackdropClick} role="dialog" aria-modal="true">
      <div class={[s.modal, s[size]].join(' ')}>
        {(title || dismissable) && (
          <header class={s.header}>
            {title && <h2 class={s.title}>{title}</h2>}
            {dismissable && (
              <button class={s.close} onClick={onClose} aria-label="Chiudi">×</button>
            )}
          </header>
        )}
        <div class={s.body}>{children}</div>
        {footer && <footer class={s.footer}>{footer}</footer>}
      </div>
    </div>
  );
}
