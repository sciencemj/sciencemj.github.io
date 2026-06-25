/* Sciencemj — shared portfolio footer + back-link.
   Include on any report page for a unified footer:
     <script src="https://sciencemj.github.io/embed/footer.js" defer></script>
   Self-contained, idempotent, and token-aware: it reuses the page's design
   tokens when present and falls back to the brand defaults otherwise. */
(function () {
  if (window.__sxFooter) return;
  window.__sxFooter = true;

  var PORTFOLIO = 'https://sciencemj.github.io/';
  var GITHUB = 'https://github.com/sciencemj';
  var EMAIL = 'mailto:sciencemj.park@gmail.com';
  var year = new Date().getFullYear();

  var css = [
    '.sx-footer{font-family:var(--font-body,"Hanken Grotesk","IBM Plex Sans KR",system-ui,sans-serif);',
    'border-top:1px solid var(--border,#E8DECE);background:var(--canvas,#FAF6F0);',
    'color:var(--muted,#80735F);padding:30px 0;margin-top:8px}',
    '.sx-footer .sx-in{max-width:1080px;margin:0 auto;padding:0 28px;display:flex;align-items:center;',
    'justify-content:space-between;gap:18px;flex-wrap:wrap}',
    '.sx-footer .sx-brand{display:flex;align-items:center;gap:10px;color:var(--ink,#221C16);',
    'text-decoration:none;font-family:var(--font-display,"Space Grotesk",system-ui,sans-serif);',
    'font-weight:700;font-size:15px;letter-spacing:-.02em}',
    '.sx-footer .sx-mk{width:28px;height:28px;border-radius:9px;',
    'background:linear-gradient(150deg,#F2783A,#CE551E);display:grid;place-items:center;',
    'box-shadow:0 6px 14px rgba(232,104,43,.3);flex-shrink:0}',
    '.sx-footer .sx-mk svg{width:16px;height:16px;display:block}',
    '.sx-footer .sx-accent{color:var(--accent,#E8682B)}',
    '.sx-footer .sx-back{display:inline-flex;align-items:center;gap:7px;',
    'color:var(--accent,#E8682B);font-weight:600;font-size:14px;text-decoration:none}',
    '.sx-footer .sx-back:hover{text-decoration:underline}',
    '.sx-footer .sx-links{display:flex;align-items:center;gap:18px;font-size:14px}',
    '.sx-footer .sx-links a{display:inline-flex;align-items:center;gap:6px;color:var(--ink-2,#4A4036);text-decoration:none}',
    '.sx-footer .sx-links svg{width:15px;height:15px}',
    '.sx-footer .sx-links a:hover{color:var(--accent,#E8682B)}',
    '.sx-footer .sx-meta{font-family:var(--font-mono,"JetBrains Mono",ui-monospace,monospace);',
    'font-size:12px;color:var(--muted,#80735F)}'
  ].join('');

  var mark = '<span class="sx-mk"><svg viewBox="0 0 100 100" aria-hidden="true"><g>' +
    '<rect x="22" y="22" width="9" height="58" rx="2.5" fill="#fff"/>' +
    '<rect x="34" y="46" width="9" height="34" rx="2.5" fill="#FFE2C0"/>' +
    '<rect x="46" y="36" width="9" height="44" rx="2.5" fill="#FFCBA0"/>' +
    '<rect x="58" y="46" width="9" height="34" rx="2.5" fill="#FFB994"/>' +
    '<rect x="70" y="22" width="9" height="58" rx="2.5" fill="#FFA982"/></g></svg></span>';

  function mount() {
    var style = document.createElement('style');
    style.setAttribute('data-sx-footer', '');
    style.textContent = css;
    document.head.appendChild(style);

    var f = document.createElement('footer');
    f.className = 'sx-footer';
    f.innerHTML = '<div class="sx-in">' +
      '<a class="sx-brand" href="' + PORTFOLIO + '">' + mark +
        '<span>Science<span class="sx-accent">mj</span></span></a>' +
      '<a class="sx-back" href="' + PORTFOLIO + '">← View portfolio</a>' +
      '<div class="sx-links">' +
        '<a href="' + GITHUB + '" target="_blank" rel="noopener">' +
          '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>' +
          'GitHub</a>' +
        '<a href="' + EMAIL + '">Email</a>' +
      '</div>' +
      '<span class="sx-meta">© ' + year + ' MJ · Sciencemj</span>' +
    '</div>';
    (document.body || document.documentElement).appendChild(f);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
