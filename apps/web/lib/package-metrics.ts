/**
 * Calcoli metrici per colli: volume, peso volumetrico, peso tassabile.
 */

/** Volume in m³ */
export function calcVolume(lunghezza: number, larghezza: number, altezza: number): number {
  return (lunghezza * larghezza * altezza) / 1_000_000;
}

/** Peso volumetrico in kg (formula standard L×W×H / 5000, dimensioni in cm) */
export function calcPesoVolumetrico(lunghezza: number, larghezza: number, altezza: number): number {
  return (lunghezza * larghezza * altezza) / 5000;
}

/** Peso tassabile: il maggiore tra peso reale e peso volumetrico */
export function calcPesoTassabile(
  pesoReale: number,
  lunghezza: number,
  larghezza: number,
  altezza: number
): { pesoTassabile: number; usaVolumetrico: boolean } {
  const pesoVolumetrico = calcPesoVolumetrico(lunghezza, larghezza, altezza);
  const usaVolumetrico = pesoVolumetrico > pesoReale;
  return {
    pesoTassabile: Math.max(pesoReale, pesoVolumetrico),
    usaVolumetrico,
  };
}
