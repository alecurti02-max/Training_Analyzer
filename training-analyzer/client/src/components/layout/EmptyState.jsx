// EmptyState: placeholder centrato per liste vuote. Avvolge .empty-state.
export function EmptyState({ title, hint = null, children }) {
  return (
    <div class="empty-state">
      {title && <p>{title}</p>}
      {hint && <p style="font-size:.85rem">{hint}</p>}
      {children}
    </div>
  );
}
