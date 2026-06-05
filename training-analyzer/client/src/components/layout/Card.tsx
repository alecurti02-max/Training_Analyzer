import type { ComponentChildren, JSX } from 'preact';

// Card / Panel: superficie standard. Avvolge la classe globale .card (già
// token-driven e skin-aware). Emette lo stesso DOM che CSS globale e la
// click-delegation di ui.js si aspettano.
//   hud       → tick angolari .cc-hud
//   clickable → .clickable-card (cursore + hover)
//   dataPage  → data-page=<x> per la navigazione delegata di ui.js
interface CardProps {
  hud?: boolean;
  clickable?: boolean;
  dataPage?: string;
  style?: string | JSX.CSSProperties;
  onClick?: (event: MouseEvent) => void;
  class?: string;
  children?: ComponentChildren;
}

export function Card({
  hud = false,
  clickable = false,
  dataPage,
  style,
  onClick,
  class: extra = '',
  children,
}: CardProps) {
  const cls = ['card', hud && 'cc-hud', clickable && 'clickable-card', extra]
    .filter(Boolean)
    .join(' ');
  return (
    <div class={cls} style={style} onClick={onClick} {...(dataPage ? { 'data-page': dataPage } : {})}>
      {children}
    </div>
  );
}
