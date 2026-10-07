import Link from 'next/link';
import ui from './ManagementUI.module.css';

export function SummaryMetricCard({ label, value }: { label: string; value: number }) {
    return <div className={ui.metric}><span className={ui.metricLabel}>{label}</span><strong className={ui.metricValue}>{value}<small>명</small></strong></div>;
}

export function ManagementBackLink({ href, children = '대회 정보로 돌아가기' }: { href: string; children?: React.ReactNode }) {
    return <Link href={href} className={ui.back}><span aria-hidden="true">←</span><span>{children}</span></Link>;
}
