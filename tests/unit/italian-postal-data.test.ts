/**
 * Unit Tests: italian-postal-data.ts
 *
 * Test coverage per validazione CAP/Città/Provincia con dataset postale italiano:
 * - validateCapProvince: coerenza CAP ↔ provincia
 * - validateCapCity: coerenza CAP ↔ città (capoluoghi)
 * - validateAddress: validazione completa con suggerimenti
 * - getCityInfo: lookup informazioni città
 * - getProvinceForCap: lookup provincia da CAP
 * - isValidProvince: verifica provincia valida
 */

import { describe, it, expect } from 'vitest';
import {
  validateCapProvince,
  validateCapCity,
  validateAddress,
  getCityInfo,
  getProvinceForCap,
  getCapsForCity,
  getRegionForProvince,
  isValidProvince,
  getAllProvinces,
} from '@/lib/address/italian-postal-data';

// ==================== validateCapProvince ====================

describe('validateCapProvince', () => {
  it('valida CAP coerenti con la provincia', () => {
    expect(validateCapProvince('20100', 'MI')).toBe(true);
    expect(validateCapProvince('00100', 'RM')).toBe(true);
    expect(validateCapProvince('80100', 'NA')).toBe(true);
    expect(validateCapProvince('10100', 'TO')).toBe(true);
  });

  it('rileva CAP incoerenti con la provincia', () => {
    expect(validateCapProvince('20100', 'RM')).toBe(false); // Milano CAP, Roma provincia
    expect(validateCapProvince('80100', 'MI')).toBe(false); // Napoli CAP, Milano provincia
  });

  it('rifiuta formati CAP invalidi', () => {
    expect(validateCapProvince('1234', 'MI')).toBe(false); // 4 cifre
    expect(validateCapProvince('123456', 'MI')).toBe(false); // 6 cifre
    expect(validateCapProvince('abcde', 'MI')).toBe(false); // lettere
  });

  it('rifiuta formati provincia invalidi', () => {
    expect(validateCapProvince('20100', 'M')).toBe(false); // 1 lettera
    expect(validateCapProvince('20100', 'MIL')).toBe(false); // 3 lettere
  });

  it('accetta case insensitive per provincia', () => {
    expect(validateCapProvince('20100', 'mi')).toBe(true);
    expect(validateCapProvince('20100', 'Mi')).toBe(true);
  });
});

// ==================== validateCapCity ====================

describe('validateCapCity', () => {
  it('valida CAP coerenti con la città (capoluoghi)', () => {
    expect(validateCapCity('20100', 'Milano')).toBe(true);
    expect(validateCapCity('20121', 'Milano')).toBe(true); // Range CAP Milano
    expect(validateCapCity('00100', 'Roma')).toBe(true);
    expect(validateCapCity('80134', 'Napoli')).toBe(true);
  });

  it('rileva CAP incoerenti con la città', () => {
    expect(validateCapCity('80100', 'Milano')).toBe(false);
    expect(validateCapCity('20100', 'Roma')).toBe(false);
  });

  it('accetta CAP per città non in database (non invalida)', () => {
    expect(validateCapCity('20010', 'Cornaredo')).toBe(true);
    expect(validateCapCity('12345', 'Paese Sconosciuto')).toBe(true);
  });

  it('gestisce case insensitive per città', () => {
    expect(validateCapCity('20100', 'milano')).toBe(true);
    expect(validateCapCity('20100', 'MILANO')).toBe(true);
  });
});

// ==================== validateAddress ====================

describe('validateAddress', () => {
  it('validazione completa corretta', () => {
    const result = validateAddress('20100', 'Milano', 'MI');
    expect(result.valid).toBe(true);
  });

  it('rileva provincia errata per città nota', () => {
    const result = validateAddress('20100', 'Milano', 'RM');
    expect(result.valid).toBe(false);
    expect(result.suggestion?.correctProvince).toBe('MI');
  });

  it('rileva CAP errato per città nota', () => {
    const result = validateAddress('80100', 'Milano', 'MI');
    expect(result.valid).toBe(false);
    expect(result.suggestion?.correctCap).toBeDefined();
  });

  it('rileva CAP/provincia incoerenti', () => {
    const result = validateAddress('20100', 'Paese Qualsiasi', 'NA');
    expect(result.valid).toBe(false);
    expect(result.suggestion?.correctProvince).toBeDefined();
  });

  it('rileva formato CAP invalido', () => {
    const result = validateAddress('123', 'Milano', 'MI');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('5 cifre');
  });

  it('rileva formato provincia invalido', () => {
    const result = validateAddress('20100', 'Milano', 'MIL');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('2 lettere');
  });
});

// ==================== getCityInfo ====================

describe('getCityInfo', () => {
  it('restituisce info per capoluoghi noti', () => {
    const milano = getCityInfo('Milano');
    expect(milano).toBeDefined();
    expect(milano!.province).toBe('MI');
    expect(milano!.region).toBe('Lombardia');

    const roma = getCityInfo('Roma');
    expect(roma).toBeDefined();
    expect(roma!.province).toBe('RM');
    expect(roma!.region).toBe('Lazio');
  });

  it('restituisce undefined per città non in database', () => {
    expect(getCityInfo('Cornaredo')).toBeUndefined();
  });

  it('gestisce case insensitive', () => {
    expect(getCityInfo('milano')?.province).toBe('MI');
    expect(getCityInfo('ROMA')?.province).toBe('RM');
  });
});

// ==================== getProvinceForCap ====================

describe('getProvinceForCap', () => {
  it('restituisce provincia corretta per CAP noti', () => {
    expect(getProvinceForCap('20100')).toBe('MI');
    expect(getProvinceForCap('00100')).toBe('RM');
    expect(getProvinceForCap('80100')).toBe('NA');
    expect(getProvinceForCap('10100')).toBe('TO');
  });

  it('restituisce undefined per CAP invalido', () => {
    expect(getProvinceForCap('1234')).toBeUndefined();
    expect(getProvinceForCap('abcde')).toBeUndefined();
  });
});

// ==================== getCapsForCity ====================

describe('getCapsForCity', () => {
  it('restituisce CAP per capoluoghi noti', () => {
    const caps = getCapsForCity('Milano');
    expect(caps.length).toBeGreaterThan(0);
    expect(caps[0]).toMatch(/^\d{5}$/);
  });

  it('restituisce array vuoto per città non in database', () => {
    expect(getCapsForCity('Cornaredo')).toEqual([]);
  });

  it('filtra per provincia se specificata', () => {
    expect(getCapsForCity('Milano', 'MI').length).toBeGreaterThan(0);
    expect(getCapsForCity('Milano', 'RM')).toEqual([]);
  });
});

// ==================== getRegionForProvince ====================

describe('getRegionForProvince', () => {
  it('restituisce regione corretta', () => {
    expect(getRegionForProvince('MI')).toBe('Lombardia');
    expect(getRegionForProvince('RM')).toBe('Lazio');
    expect(getRegionForProvince('NA')).toBe('Campania');
    expect(getRegionForProvince('PA')).toBe('Sicilia');
    expect(getRegionForProvince('CA')).toBe('Sardegna');
  });

  it('accetta lowercase', () => {
    expect(getRegionForProvince('mi')).toBe('Lombardia');
  });

  it('restituisce undefined per provincia invalida', () => {
    expect(getRegionForProvince('XX')).toBeUndefined();
  });
});

// ==================== isValidProvince / getAllProvinces ====================

describe('isValidProvince', () => {
  it('riconosce province valide', () => {
    expect(isValidProvince('MI')).toBe(true);
    expect(isValidProvince('RM')).toBe(true);
    expect(isValidProvince('BT')).toBe(true); // Barletta-Andria-Trani
    expect(isValidProvince('SU')).toBe(true); // Sud Sardegna
  });

  it('rifiuta province invalide', () => {
    expect(isValidProvince('XX')).toBe(false);
    expect(isValidProvince('ZZ')).toBe(false);
  });
});

describe('getAllProvinces', () => {
  it('restituisce tutte le province ordinate', () => {
    const provinces = getAllProvinces();
    expect(provinces.length).toBeGreaterThanOrEqual(100);
    expect(provinces[0]).toBe('AG'); // Prima in ordine alfabetico
    expect(provinces).toContain('MI');
    expect(provinces).toContain('RM');
  });
});
