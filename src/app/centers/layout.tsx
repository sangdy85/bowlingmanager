import type { ReactNode } from 'react';
import controls from '@/components/tournaments/CenterControls.module.css';

export default function CentersLayout({ children }: { children: ReactNode }) {
    return <div className={controls.workspace}>{children}</div>;
}
