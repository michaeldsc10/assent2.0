/* ═══════════════════════════════════════════════════
   ASSENT v2.0 — consoleSanitizer.js
   Silencia TODOS os logs no build de produção.

   CHAME UMA VEZ no topo do main.jsx:
     import '@/utils/consoleSanitizer';
   ═══════════════════════════════════════════════════ */

if (import.meta.env.PROD) {
  const noop = () => {};

  console.log   = noop;
  console.warn  = noop;
  console.error = noop;
  console.info  = noop;
  console.debug = noop;
  console.table = noop;
  console.group = noop;
  console.groupEnd = noop;
  console.groupCollapsed = noop;
}
