import { redirect } from 'next/navigation';

// /dashboard → /admin (store owner dashboard alias)
export default function DashboardPage() {
  redirect('/admin');
}
