/**
 * Unit Tests: sanitizeEmailHtml (sanitize-html)
 *
 * Verifica che la sanitizzazione HTML rimuova vettori XSS
 * e preservi tag/attributi sicuri per email.
 */

import { describe, it, expect } from 'vitest';
import { sanitizeEmailHtml } from '@/lib/email/workspace-email-service';

describe('sanitizeEmailHtml (sanitize-html)', () => {
  // ─── TAG PERICOLOSI ───

  it('dovrebbe rimuovere tag <script>', () => {
    const result = sanitizeEmailHtml('<p>Ciao</p><script>alert("xss")</script>');
    expect(result).not.toContain('<script');
    expect(result).toContain('Ciao');
  });

  it('dovrebbe rimuovere tag <iframe>', () => {
    const result = sanitizeEmailHtml('<p>Testo</p><iframe src="http://evil.com"></iframe>');
    expect(result).not.toContain('<iframe');
    expect(result).toContain('Testo');
  });

  it('dovrebbe rimuovere tag <svg>', () => {
    const result = sanitizeEmailHtml('<svg onload="alert(1)"><circle/></svg><p>OK</p>');
    expect(result).not.toContain('<svg');
    expect(result).toContain('OK');
  });

  it('dovrebbe rimuovere tag <form> e <input>', () => {
    const result = sanitizeEmailHtml('<form action="http://evil.com"><input type="text"></form>');
    expect(result).not.toContain('<form');
    expect(result).not.toContain('<input');
  });

  it('dovrebbe rimuovere tag <style>', () => {
    const result = sanitizeEmailHtml('<style>body { display: none; }</style><p>Contenuto</p>');
    expect(result).not.toContain('<style');
    expect(result).toContain('Contenuto');
  });

  it('dovrebbe rimuovere tag <object> e <embed>', () => {
    const result = sanitizeEmailHtml('<object data="evil.swf"></object><embed src="evil.swf">');
    expect(result).not.toContain('<object');
    expect(result).not.toContain('<embed');
  });

  // ─── EVENT HANDLER ───

  it('dovrebbe rimuovere event handler inline', () => {
    const result = sanitizeEmailHtml('<img src="https://example.com/pic.jpg" onerror="alert(1)">');
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert');
  });

  it('dovrebbe rimuovere onclick handler', () => {
    const result = sanitizeEmailHtml('<a href="https://example.com" onclick="steal()">Click</a>');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('steal');
  });

  // ─── PROTOCOLLI PERICOLOSI ───

  it('dovrebbe rimuovere javascript: da href', () => {
    const result = sanitizeEmailHtml('<a href="javascript:alert(1)">Click</a>');
    expect(result).not.toContain('javascript:');
  });

  it('dovrebbe bloccare HTML entity encoded javascript:', () => {
    const result = sanitizeEmailHtml('<a href="&#106;avascript:alert(1)">Click</a>');
    expect(result).not.toContain('javascript:');
  });

  it('dovrebbe bloccare vbscript: protocol', () => {
    const result = sanitizeEmailHtml('<a href="vbscript:MsgBox(1)">Click</a>');
    expect(result).not.toContain('vbscript:');
  });

  it('dovrebbe bloccare data: protocol in src', () => {
    const result = sanitizeEmailHtml('<img src="data:text/html,<script>alert(1)</script>">');
    expect(result).not.toContain('data:text/html');
  });

  // ─── RECOMPOSITION ATTACK ───

  it('dovrebbe bloccare recomposition attack (<scr<script>ipt>)', () => {
    const result = sanitizeEmailHtml('<scr<script>ipt>alert(1)</scr</script>ipt>');
    expect(result).not.toContain('<script');
  });

  // ─── TAG E ATTRIBUTI SICURI ───

  it('dovrebbe preservare tag HTML sicuri per email', () => {
    const html = '<h1>Titolo</h1><p>Paragrafo con <strong>bold</strong> e <em>italic</em></p>';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('<h1>');
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
    expect(result).toContain('<em>');
  });

  it('dovrebbe preservare link sicuri con https', () => {
    const html = '<a href="https://example.com">Link</a>';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('Link');
  });

  it('dovrebbe preservare immagini con src https', () => {
    const html = '<img src="https://example.com/logo.png" alt="Logo" width="100" />';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('src="https://example.com/logo.png"');
    expect(result).toContain('alt="Logo"');
  });

  it('dovrebbe preservare tabelle HTML per email', () => {
    const html = '<table border="1"><tr><td>Cella</td></tr></table>';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('<table');
    expect(result).toContain('<tr>');
    expect(result).toContain('<td>');
    expect(result).toContain('Cella');
  });

  it('dovrebbe preservare liste', () => {
    const html = '<ul><li>Primo</li><li>Secondo</li></ul>';
    const result = sanitizeEmailHtml(html);
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>');
  });

  // ─── EDGE CASES ───

  it('dovrebbe gestire stringa vuota', () => {
    expect(sanitizeEmailHtml('')).toBe('');
  });

  it('dovrebbe gestire input null/undefined difensivamente', () => {
    expect(sanitizeEmailHtml(null as unknown as string)).toBe('');
    expect(sanitizeEmailHtml(undefined as unknown as string)).toBe('');
  });

  it('dovrebbe gestire testo puro senza HTML', () => {
    const result = sanitizeEmailHtml('Testo semplice senza tag');
    expect(result).toBe('Testo semplice senza tag');
  });
});
