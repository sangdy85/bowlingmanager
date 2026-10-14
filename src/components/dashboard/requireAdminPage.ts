import { auth } from '@/auth';
import { redirect } from 'next/navigation';

// The existing layout rule must also run before queries: Next can render page
// segments concurrently with layouts and serialize them into redirect responses.
export async function requireAdminPage() {
    const session = await auth();
    if (session?.user?.role !== 'SUPER_ADMIN') redirect('/');
}
