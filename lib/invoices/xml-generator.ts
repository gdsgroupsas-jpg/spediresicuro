/**
 * Invoice XML Generator (FatturaPA)
 * 
 * Genera XML conformi al formato FatturaPA (standard italiano fatturazione elettronica).
 * Compatibile con:
 * - Sistema di Interscambio (SDI) Agenzia delle Entrate
 * - Aruba Fatturazione Elettronica
 * - Fatturazione e Corrispettivi
 * 
 * SPECIFICA: Formato FatturaPA 1.2.1 (D.M. 17/06/2014 e successive modifiche)
 * 
 * @module lib/invoices/xml-generator
 */

import { InvoiceData } from './pdf-generator';

/**
 * Dati aggiuntivi per XML FatturaPA
 */
export interface FatturaPAData extends InvoiceData {
  // Codice destinatario SDI (7 caratteri) o PEC
  sdiCode?: string;
  pec?: string;
  
  // Tipo documento (TD01 = Fattura, TD04 = Nota di credito)
  documentType?: 'TD01' | 'TD04';
  
  // Causale pagamento (opzionale)
  paymentReason?: string;
  
  // Dati mittente aggiuntivi
  sender: InvoiceData['sender'] & {
    sdiCode?: string; // Codice SDI mittente
    pec?: string; // PEC mittente
  };
}

/**
 * Genera XML FatturaPA conforme normativa italiana
 * 
 * @param data - Dati fattura con informazioni SDI
 * @returns Buffer XML conforme FatturaPA
 */
export async function generateInvoiceXML(data: FatturaPAData): Promise<Buffer> {
  // Validazione dati obbligatori
  if (!data.sender.vatNumber || !data.sender.taxCode) {
    throw new Error('Dati mittente incompleti: P.IVA e C.F. obbligatori per fatturazione elettronica');
  }

  if (!data.recipient.vatNumber && !data.recipient.taxCode) {
    throw new Error('Dati destinatario incompleti: P.IVA o C.F. obbligatori');
  }

  // Calcoli
  const subtotal = data.items.reduce((sum, item) => sum + item.total, 0);
  const vat = data.items.reduce((sum, item) => sum + (item.total * item.vatRate / 100), 0);
  const total = subtotal + vat;

  // Formatta date ISO 8601 (YYYY-MM-DD)
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Formatta numero progressivo (rimuove prefisso anno se presente)
  const progressivoNumero = data.invoiceNumber.includes('-') 
    ? data.invoiceNumber.split('-')[1] 
    : data.invoiceNumber;

  // Tipo documento (default: Fattura)
  const tipoDocumento = data.documentType || 'TD01';

  // Codice destinatario (SDI o PEC)
  const codiceDestinatario = data.sdiCode || data.pec || '0000000';

  // XML conforme FatturaPA 1.2.1
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" versione="FPA12" xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_versione_1.2.xsd">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>${escapeXml(data.sender.vatNumber.replace(/[^0-9]/g, '').substring(0, 11))}</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>${escapeXml(progressivoNumero)}</ProgressivoInvio>
      <FormatoTrasmissione>FPA12</FormatoTrasmissione>
      <CodiceDestinatario>${escapeXml(codiceDestinatario)}</CodiceDestinatario>
      ${data.pec ? `<PECDestinatario>${escapeXml(data.pec)}</PECDestinatario>` : ''}
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${escapeXml(data.sender.vatNumber.replace(/[^0-9]/g, '').substring(0, 11))}</IdCodice>
        </IdFiscaleIVA>
        <CodiceFiscale>${escapeXml(data.sender.taxCode)}</CodiceFiscale>
        <Anagrafica>
          <Denominazione>${escapeXml(data.sender.companyName)}</Denominazione>
        </Anagrafica>
        <RegimeFiscale>RF01</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXml(data.sender.address)}</Indirizzo>
        ${data.sender.zip ? `<NumeroCivico>${escapeXml(data.sender.zip)}</NumeroCivico>` : ''}
        ${data.sender.city ? `<Comune>${escapeXml(data.sender.city)}</Comune>` : ''}
        ${data.sender.province ? `<Provincia>${escapeXml(data.sender.province)}</Provincia>` : ''}
        <CAP>${escapeXml(data.sender.zip || '')}</CAP>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        ${data.recipient.vatNumber ? `
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${escapeXml(data.recipient.vatNumber.replace(/[^0-9]/g, '').substring(0, 11))}</IdCodice>
        </IdFiscaleIVA>
        ` : ''}
        ${data.recipient.taxCode ? `<CodiceFiscale>${escapeXml(data.recipient.taxCode)}</CodiceFiscale>` : ''}
        <Anagrafica>
          <Denominazione>${escapeXml(data.recipient.name)}</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXml(data.recipient.address)}</Indirizzo>
        ${data.recipient.zip ? `<NumeroCivico>${escapeXml(data.recipient.zip)}</NumeroCivico>` : ''}
        ${data.recipient.city ? `<Comune>${escapeXml(data.recipient.city)}</Comune>` : ''}
        ${data.recipient.province ? `<Provincia>${escapeXml(data.recipient.province)}</Provincia>` : ''}
        <CAP>${escapeXml(data.recipient.zip || '')}</CAP>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>${tipoDocumento}</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${formatDate(data.issueDate)}</Data>
        <Numero>${escapeXml(progressivoNumero)}</Numero>
        ${data.dueDate ? `<DataScadenzaPagamento>${formatDate(data.dueDate)}</DataScadenzaPagamento>` : ''}
        ${data.paymentReason ? `<Causale>${escapeXml(data.paymentReason)}</Causale>` : ''}
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      ${data.items.map((item, index) => `
      <DettaglioLinee>
        <NumeroLinea>${index + 1}</NumeroLinea>
        <Descrizione>${escapeXml(item.description)}</Descrizione>
        <Quantita>${item.quantity.toFixed(2)}</Quantita>
        <PrezzoUnitario>${item.unitPrice.toFixed(2)}</PrezzoUnitario>
        <PrezzoTotale>${item.total.toFixed(2)}</PrezzoTotale>
        <AliquotaIVA>${item.vatRate.toFixed(2)}</AliquotaIVA>
      </DettaglioLinee>
      `).join('')}
      <DatiRiepilogo>
        <AliquotaIVA>${data.items[0]?.vatRate.toFixed(2) || '22.00'}</AliquotaIVA>
        <ImponibileImporto>${subtotal.toFixed(2)}</ImponibileImporto>
        <Imposta>${vat.toFixed(2)}</Imposta>
        <EsigibilitaIVA>I</EsigibilitaIVA>
      </DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>MP05</ModalitaPagamento>
        <DataScadenzaPagamento>${data.dueDate ? formatDate(data.dueDate) : formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))}</DataScadenzaPagamento>
        <ImportoPagamento>${total.toFixed(2)}</ImportoPagamento>
        ${data.iban ? `<IBAN>${escapeXml(data.iban.replace(/\s/g, ''))}</IBAN>` : ''}
      </DettaglioPagamento>
    </DatiPagamento>
    ${data.notes ? `
    <Allegati>
      <NomeAttachment>Note</NomeAttachment>
      <DescrizioneAttachment>${escapeXml(data.notes)}</DescrizioneAttachment>
    </Allegati>
    ` : ''}
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

  return Buffer.from(xml, 'utf-8');
}

/**
 * Escape XML special characters
 * Sicurezza: previene injection XML
 */
function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Valida XML FatturaPA prima della generazione
 * 
 * @param data - Dati fattura
 * @returns Array di errori (vuoto se valido)
 */
export function validateFatturaPAData(data: FatturaPAData): string[] {
  const errors: string[] = [];

  // Validazione mittente
  if (!data.sender.vatNumber || data.sender.vatNumber.length < 11) {
    errors.push('P.IVA mittente obbligatoria e deve essere di almeno 11 caratteri');
  }

  if (!data.sender.taxCode || data.sender.taxCode.length !== 16) {
    errors.push('Codice Fiscale mittente obbligatorio e deve essere di 16 caratteri');
  }

  if (!data.sender.companyName) {
    errors.push('Ragione sociale mittente obbligatoria');
  }

  if (!data.sender.address) {
    errors.push('Indirizzo mittente obbligatorio');
  }

  // Validazione destinatario
  if (!data.recipient.vatNumber && !data.recipient.taxCode) {
    errors.push('P.IVA o Codice Fiscale destinatario obbligatorio');
  }

  if (!data.recipient.name) {
    errors.push('Nome destinatario obbligatorio');
  }

  if (!data.recipient.address) {
    errors.push('Indirizzo destinatario obbligatorio');
  }

  // Validazione SDI
  if (!data.sdiCode && !data.pec) {
    errors.push('Codice SDI o PEC destinatario obbligatorio per fatturazione elettronica');
  }

  if (data.sdiCode && data.sdiCode.length !== 7) {
    errors.push('Codice SDI deve essere di 7 caratteri');
  }

  // Validazione items
  if (!data.items || data.items.length === 0) {
    errors.push('Almeno una riga fattura obbligatoria');
  }

  data.items.forEach((item, index) => {
    if (!item.description) {
      errors.push(`Descrizione riga ${index + 1} obbligatoria`);
    }
    if (item.quantity <= 0) {
      errors.push(`Quantità riga ${index + 1} deve essere positiva`);
    }
    if (item.unitPrice < 0) {
      errors.push(`Prezzo unitario riga ${index + 1} non può essere negativo`);
    }
    if (item.vatRate < 0 || item.vatRate > 100) {
      errors.push(`Aliquota IVA riga ${index + 1} deve essere tra 0 e 100`);
    }
  });

  // Validazione numero fattura
  if (!data.invoiceNumber) {
    errors.push('Numero fattura obbligatorio');
  }

  return errors;
}
