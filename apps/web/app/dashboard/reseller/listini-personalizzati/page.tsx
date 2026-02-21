import { redirect } from 'next/navigation';

export default function ListiniPersonalizzatiRedirect() {
  redirect('/dashboard/reseller/listini?tab=personalizzati');
}
