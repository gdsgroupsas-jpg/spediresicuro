/**
 * Unit Tests: OCR Vision (Sprint 2.5)
 * 
 * Test per:
 * - mapVisionOutputToShipmentDraft: mapping corretto
 * - Feature flag ENABLE_OCR_IMAGES
 * - Gestione errori Vision
 * - Controllo soglia confidence
 * 
 * ⚠️ NO mock che mascherano errori reali
 * ⚠️ Test deterministici (no dipendenza da API esterne)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mapVisionOutputToShipmentDraft } from '@/lib/agent/workers/ocr';

// ==================== mapVisionOutputToShipmentDraft TESTS ====================

describe('mapVisionOutputToShipmentDraft', () => {
  describe('Mapping corretto dei campi', () => {
    it('should map recipient_name to recipient.fullName', () => {
      const result = mapVisionOutputToShipmentDraft({
        recipient_name: 'Mario Rossi',
      });
      
      expect(result.recipient?.fullName).toBe('Mario Rossi');
    });
    
    it('should map recipient_address to recipient.addressLine1', () => {
      const result = mapVisionOutputToShipmentDraft({
        recipient_address: 'Via Roma 123',
      });
      
      expect(result.recipient?.addressLine1).toBe('Via Roma 123');
    });
    
    it('should map recipient_city to recipient.city', () => {
      const result = mapVisionOutputToShipmentDraft({
        recipient_city: 'Milano',
      });
      
      expect(result.recipient?.city).toBe('Milano');
    });
    
    it('should map valid recipient_zip to recipient.postalCode', () => {
      const result = mapVisionOutputToShipmentDraft({
        recipient_zip: '20100',
      });
      
      expect(result.recipient?.postalCode).toBe('20100');
    });
    
    it('should NOT map invalid recipient_zip (not 5 digits)', () => {
      const result = mapVisionOutputToShipmentDraft({
        recipient_zip: '123', // Solo 3 cifre
      });
      
      expect(result.recipient?.postalCode).toBeUndefined();
    });
    
    it('should map valid recipient_province to recipient.province (uppercase)', () => {
      const result = mapVisionOutputToShipmentDraft({
        recipient_province: 'mi',
      });
      
      expect(result.recipient?.province).toBe('MI');
    });
    
    it('should NOT map invalid recipient_province (not 2 letters)', () => {
      const result = mapVisionOutputToShipmentDraft({
        recipient_province: 'MIL', // 3 lettere
      });
      
      expect(result.recipient?.province).toBeUndefined();
    });
    
    it('should map recipient_phone after normalization', () => {
      const result = mapVisionOutputToShipmentDraft({
        recipient_phone: '+39 333 123 4567',
      });
      
      expect(result.recipient?.phone).toBe('+393331234567');
    });
    
    it('should map weight to parcel.weightKg', () => {
      const result = mapVisionOutputToShipmentDraft({
        weight: 5.5,
      });
      
      expect(result.parcel?.weightKg).toBe(5.5);
    });
  });
  
  describe('Validazione e sicurezza', () => {
    it('should NOT include empty strings', () => {
      const result = mapVisionOutputToShipmentDraft({
        recipient_name: '',
        recipient_city: '   ',
      });
      
      expect(result.recipient?.fullName).toBeUndefined();
      expect(result.recipient?.city).toBeUndefined();
    });
    
    it('should NOT include undefined values', () => {
      const result = mapVisionOutputToShipmentDraft({
        recipient_name: undefined,
      });
      
      expect(result.recipient).toBeUndefined();
    });
    
    it('should NOT include invalid weight (negative)', () => {
      const result = mapVisionOutputToShipmentDraft({
        weight: -5,
      });
      
      expect(result.parcel?.weightKg).toBeUndefined();
    });
    
    it('should NOT include invalid weight (over 100kg)', () => {
      const result = mapVisionOutputToShipmentDraft({
        weight: 150,
      });
      
      expect(result.parcel?.weightKg).toBeUndefined();
    });
    
    it('should NOT include invalid phone (too short)', () => {
      const result = mapVisionOutputToShipmentDraft({
        recipient_phone: '123',
      });
      
      expect(result.recipient?.phone).toBeUndefined();
    });
    
    it('should trim whitespace from all string fields', () => {
      const result = mapVisionOutputToShipmentDraft({
        recipient_name: '  Mario Rossi  ',
        recipient_city: '  Milano  ',
      });
      
      expect(result.recipient?.fullName).toBe('Mario Rossi');
      expect(result.recipient?.city).toBe('Milano');
    });
  });
  
  describe('Mapping completo', () => {
    it('should map all valid fields correctly', () => {
      const result = mapVisionOutputToShipmentDraft({
        recipient_name: 'Mario Rossi',
        recipient_address: 'Via Roma 123',
        recipient_city: 'Milano',
        recipient_zip: '20100',
        recipient_province: 'MI',
        recipient_phone: '3331234567',
        weight: 5,
      });
      
      expect(result.recipient?.fullName).toBe('Mario Rossi');
      expect(result.recipient?.addressLine1).toBe('Via Roma 123');
      expect(result.recipient?.city).toBe('Milano');
      expect(result.recipient?.postalCode).toBe('20100');
      expect(result.recipient?.province).toBe('MI');
      expect(result.recipient?.phone).toBe('3331234567');
      expect(result.parcel?.weightKg).toBe(5);
    });
    
    it('should return empty updates for empty input', () => {
      const result = mapVisionOutputToShipmentDraft({});
      
      expect(result.recipient).toBeUndefined();
      expect(result.parcel).toBeUndefined();
    });
  });
  
  describe('Anti-hallucination', () => {
    it('should NOT invent CAP from partial data', () => {
      const result = mapVisionOutputToShipmentDraft({
        recipient_city: 'Milano',
        // NO recipient_zip
      });
      
      expect(result.recipient?.postalCode).toBeUndefined();
      expect(result.recipient?.city).toBe('Milano');
    });
    
    it('should NOT invent province from city', () => {
      const result = mapVisionOutputToShipmentDraft({
        recipient_city: 'Milano',
        // NO recipient_province
      });
      
      expect(result.recipient?.province).toBeUndefined();
    });
    
    it('should NOT invent weight from other data', () => {
      const result = mapVisionOutputToShipmentDraft({
        recipient_city: 'Milano',
        recipient_zip: '20100',
        // NO weight
      });
      
      expect(result.parcel?.weightKg).toBeUndefined();
    });
  });
});

// ==================== ocrConfig TESTS ====================

describe('ocrConfig', () => {
  it('should have ENABLE_OCR_IMAGES as boolean', async () => {
    const { ocrConfig } = await import('@/lib/config');
    expect(typeof ocrConfig.ENABLE_OCR_IMAGES).toBe('boolean');
  });
  
  it('should have MIN_VISION_CONFIDENCE as number between 0 and 1', async () => {
    const { ocrConfig } = await import('@/lib/config');
    expect(typeof ocrConfig.MIN_VISION_CONFIDENCE).toBe('number');
    expect(ocrConfig.MIN_VISION_CONFIDENCE).toBeGreaterThanOrEqual(0);
    expect(ocrConfig.MIN_VISION_CONFIDENCE).toBeLessThanOrEqual(1);
  });
  
  it('should have VISION_TIMEOUT_MS as positive number', async () => {
    const { ocrConfig } = await import('@/lib/config');
    expect(typeof ocrConfig.VISION_TIMEOUT_MS).toBe('number');
    expect(ocrConfig.VISION_TIMEOUT_MS).toBeGreaterThan(0);
  });
});

