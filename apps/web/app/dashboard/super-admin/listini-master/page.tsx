import { redirect } from 'next/navigation';

export default function ListiniMasterRedirect() {
  redirect('/dashboard/listini?tab=master');
}
