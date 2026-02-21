export interface QuickModeFormData {
  mittenteNome: string;
  mittenteIndirizzo: string;
  mittenteCitta: string;
  mittenteProvincia: string;
  mittenteCap: string;
  mittenteTelefono: string;
  mittenteEmail: string;
  destinatarioNome: string;
  destinatarioIndirizzo: string;
  destinatarioCitta: string;
  destinatarioProvincia: string;
  destinatarioCap: string;
  destinatarioTelefono: string;
  destinatarioEmail: string;
  peso: string;
  tipoSpedizione: string;
  corriere: string;
  contrassegnoAmount: string;
}

export function computeQuickModeValidation(formData: QuickModeFormData) {
  const contrassegnoAttivo =
    formData.contrassegnoAmount && parseFloat(formData.contrassegnoAmount) > 0;

  return {
    mittenteNome: formData.mittenteNome.length >= 2,
    mittenteIndirizzo: formData.mittenteIndirizzo.length >= 5,
    mittenteCitta:
      formData.mittenteCitta.length >= 2 &&
      formData.mittenteProvincia.length >= 2 &&
      formData.mittenteCap.length >= 5,
    mittenteProvincia: formData.mittenteProvincia.length >= 2,
    mittenteCap: formData.mittenteCap.length >= 5,
    mittenteTelefono: /^[\d\s+\-()]{8,}$/.test(formData.mittenteTelefono),
    mittenteEmail:
      !formData.mittenteEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.mittenteEmail),
    destinatarioNome: formData.destinatarioNome.length >= 2,
    destinatarioIndirizzo: formData.destinatarioIndirizzo.length >= 5,
    destinatarioCitta:
      formData.destinatarioCitta.length >= 2 &&
      formData.destinatarioProvincia.length >= 2 &&
      formData.destinatarioCap.length >= 5,
    destinatarioProvincia: formData.destinatarioProvincia.length >= 2,
    destinatarioCap: formData.destinatarioCap.length >= 5,
    destinatarioTelefono: contrassegnoAttivo
      ? /^[\d\s+\-()]{8,}$/.test(formData.destinatarioTelefono)
      : !formData.destinatarioTelefono || /^[\d\s+\-()]{8,}$/.test(formData.destinatarioTelefono),
    destinatarioEmail:
      !formData.destinatarioEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.destinatarioEmail),
    peso: parseFloat(formData.peso) > 0,
    contrassegnoAmount:
      !formData.contrassegnoAmount ||
      (parseFloat(formData.contrassegnoAmount) > 0 &&
        parseFloat(formData.contrassegnoAmount) <= 5000),
  };
}

export function computeQuickModeProgress(formData: QuickModeFormData): number {
  const requiredFields = [
    formData.mittenteNome,
    formData.mittenteIndirizzo,
    formData.mittenteCitta,
    formData.mittenteProvincia,
    formData.mittenteCap,
    formData.mittenteTelefono,
    formData.destinatarioNome,
    formData.destinatarioIndirizzo,
    formData.destinatarioCitta,
    formData.destinatarioProvincia,
    formData.destinatarioCap,
    formData.destinatarioTelefono,
    formData.peso,
    formData.corriere,
  ];
  const filled = requiredFields.filter((f) => f && f.length > 0).length;
  return Math.round((filled / requiredFields.length) * 100);
}

export function computeQuickModeEstimatedCost(formData: QuickModeFormData): number {
  const baseCost = 10;
  const weightCost = parseFloat(formData.peso) * 2 || 0;
  const distanceMultiplier = formData.mittenteCitta && formData.destinatarioCitta ? 1.2 : 1;
  const typeMultiplier =
    formData.tipoSpedizione === 'express'
      ? 1.5
      : formData.tipoSpedizione === 'assicurata'
        ? 1.3
        : 1;

  return Math.round((baseCost + weightCost) * distanceMultiplier * typeMultiplier);
}
