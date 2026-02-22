/**
 * Sanitizzazione HTML lato client (browser)
 *
 * Rimuove tag e attributi pericolosi da HTML non fidato prima del rendering.
 * Usato nei componenti React 'use client' dove sanitize-html (Node.js) non è disponibile.
 *
 * NOTA: Per sanitizzazione server-side usare sanitizeEmailHtml() da
 * @/lib/email/workspace-email-service (basato su sanitize-html + htmlparser2).
 *
 * Protezioni:
 *   - Rimuove tag eseguibili (script, style, iframe, form, object, embed, ecc.)
 *   - Rimuove tutti gli event handler inline (onclick, onload, onerror, ecc.)
 *   - Doppio passaggio anti-recomposition (es. <scr<script>ipt>)
 *   - Rimuove protocolli pericolosi negli href/src (javascript:, vbscript:, data:)
 */
export function sanitizeHtmlClient(html: string): string {
  if (!html) return '';

  // Tag eseguibili o pericolosi
  const dangerousTags =
    /<\s*\/?\s*(script|style|iframe|object|embed|form|input|textarea|button|link|meta|base|applet|svg|math|template|noscript)\b[^>]*>/gi;

  let s = html;

  // Primo passaggio: rimuovi tag pericolosi
  s = s.replace(dangerousTags, '');

  // Rimuovi event handler inline (onclick, onload, onerror, onmouseover, ecc.)
  s = s.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  // Rimuovi protocolli pericolosi in href e src
  s = s.replace(/(href|src)\s*=\s*["']\s*(javascript|vbscript|data)\s*:/gi, '$1="#"');

  // Secondo passaggio anti-recomposition (tag che si riformano dopo il primo replace)
  s = s.replace(dangerousTags, '');
  s = s.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  return s;
}
