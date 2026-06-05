import type { ComponentChildren } from 'preact';

// EmptyState: placeholder centrato per liste vuote. Avvolge .empty-state.
interface EmptyStateProps {
  title?: string;
  hint?: string | null;
  children?: ComponentChildren;
}

export function EmptyState({ title, hint = null, children }: EmptyStateProps) {
  return (
    <div class="empty-state">
      {title && <p>{title}</p>}
      {hint && <p style="font-size:.85rem">{hint}</p>}
      {children}
    </div>
  );
}
