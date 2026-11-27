import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Account recovery and its email/password forms are utility pages, not search content.
// Keep them crawlable so Google can see noindex; do not add a robots.txt disallow.
export const metadata: Metadata = {
    title: '계정 찾기 | 볼링매니저',
    robots: { index: false, follow: false },
};

export default function AccountRecoverySearchPolicy({ children }: { children: ReactNode }) {
    return children;
}
