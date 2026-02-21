import { redirect } from 'next/navigation';

export default function ListiniFornitoreRedirect() {
  redirect('/dashboard/reseller/listini?tab=fornitore');
}
