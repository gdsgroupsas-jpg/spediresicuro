export function toCarrierCodeFromContract(contractCode: string): string {
  if (!contractCode) return '';
  const [carrierCode] = contractCode.split('-', 1);
  return carrierCode || '';
}
