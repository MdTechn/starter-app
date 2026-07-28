import { redirect } from 'next/navigation';

/** Alias admin → settings organization page. */
export default function AdminOrganizationRedirect() {
  redirect('/settings/organization');
}
