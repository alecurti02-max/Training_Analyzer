// Card / Panel: superficie standard. Avvolge la classe globale .card (già
// token-driven e skin-aware), quindi NON ridefinisce stile: emette lo stesso
// DOM che CSS globale e la click-delegation di ui.js si aspettano.
//   hud       → aggiunge i tick angolari .cc-hud
//   clickable → aggiunge .clickable-card (cursore + hover)
//   dataPage  → mette data-page=<x> per la navigazione delegata di ui.js
export function Card({
  hud = false,
  clickable = false,
  dataPage,
  style,
  onClick,
  class: extra = '',
  children,
}) {
  const cls = ['card', hud && 'cc-hud', clickable && 'clickable-card', extra]
    .filter(Boolean)
    .join(' ');
  return (
    <div class={cls} style={style} onClick={onClick} {...(dataPage ? { 'data-page': dataPage } : {})}>
      {children}
    </div>
  );
}
