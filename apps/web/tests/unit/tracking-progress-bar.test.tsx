/**
 * Test: TrackingProgressBar
 *
 * @vitest-environment happy-dom
 *
 * Verifica la corretta visualizzazione degli step per ogni stato
 * e il branch per anomalie (giacenza, exception).
 */

import * as React from 'react';
// @ts-ignore
global.React = React;
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TrackingProgressBar } from '@/components/tracking/TrackingProgressBar';

describe('TrackingProgressBar', () => {
  it('renderizza senza errori per ogni stato', () => {
    const statuses = [
      'created',
      'pending_pickup',
      'picked_up',
      'in_transit',
      'at_destination',
      'out_for_delivery',
      'delivered',
      'in_giacenza',
      'exception',
      'returned',
      'cancelled',
      'unknown',
    ];

    for (const status of statuses) {
      const html = renderToString(<TrackingProgressBar currentStatus={status} />);
      expect(html).toBeTruthy();
      expect(html.length).toBeGreaterThan(0);
    }
  });

  it('mostra lo step "Consegnato" attivo quando status e delivered', () => {
    const html = renderToString(<TrackingProgressBar currentStatus="delivered" />);
    expect(html).toContain('bg-emerald-500');
    expect(html).toContain('Consegnato');
  });

  it('mostra il branch anomalia per in_giacenza', () => {
    const html = renderToString(<TrackingProgressBar currentStatus="in_giacenza" />);
    expect(html).toContain('In Giacenza');
    expect(html).toContain('bg-amber-500');
  });

  it('mostra il branch anomalia per exception', () => {
    const html = renderToString(<TrackingProgressBar currentStatus="exception" />);
    expect(html).toContain('Eccezione');
    expect(html).toContain('bg-red-500');
  });

  it('mostra il branch anomalia per returned', () => {
    const html = renderToString(<TrackingProgressBar currentStatus="returned" />);
    expect(html).toContain('Reso');
    expect(html).toContain('bg-orange-500');
  });

  it('non mostra branch anomalia per stati normali', () => {
    const html = renderToString(<TrackingProgressBar currentStatus="in_transit" />);
    expect(html).not.toContain('>In Giacenza<');
    expect(html).not.toContain('>Eccezione<');
    expect(html).not.toContain('>Reso<');
    expect(html).not.toContain('>Annullato<');
  });

  it('rispetta la prop compact', () => {
    const htmlCompact = renderToString(<TrackingProgressBar currentStatus="in_transit" compact />);
    const htmlFull = renderToString(
      <TrackingProgressBar currentStatus="in_transit" compact={false} />
    );
    // La versione full ha il layout mobile verticale, la compact no
    expect(htmlFull.length).toBeGreaterThan(htmlCompact.length);
  });

  it('step corrente pulsa per created', () => {
    const html = renderToString(<TrackingProgressBar currentStatus="created" />);
    expect(html).toContain('animate-pulse');
  });
});
