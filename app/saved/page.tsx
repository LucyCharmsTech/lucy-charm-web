import { redirect } from 'next/navigation';

/** Old URL — saved homes now live on the profile page. */
export default function SavedRedirectPage() {
  redirect('/profile#saved-homes');
}
