'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import { saveCompetitionNotice } from '@/app/actions/competition-notices';
import type { CompetitionNoticeInput } from '@/lib/competition-notices';
import portal from '@/components/portal/Portal.module.css';
import styles from './Competitions.module.css';

type Initial = CompetitionNoticeInput & {id: string; updatedAt: string};
export default function CompetitionEditor({initial}: {initial?: Initial}) {
    const router = useRouter();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const field = (name: keyof CompetitionNoticeInput, label: string, max: number, placeholder = '') => <label key={name}>{label}<input name={name} defaultValue={String(initial?.[name] ?? '')} maxLength={max} placeholder={placeholder} required /></label>;
    const dateField = (name: keyof CompetitionNoticeInput, label: string) => <label key={name}>{label}<input type="date" name={name} defaultValue={String(initial?.[name] ?? '')} min="1900-01-01" max="2200-12-31" required /></label>;
    return <form className={portal.form} onSubmit={async event => {
        event.preventDefault(); if (pending) return;
        const form = new FormData(event.currentTarget);
        const input = Object.fromEntries(form.entries()) as unknown as CompetitionNoticeInput;
        input.published = form.get('published') === 'on';
        setPending(true); setError('');
        try {
            const result = await saveCompetitionNotice(initial?.id ?? null, input, initial?.updatedAt);
            if (result.error) { setError(result.error); setPending(false); return; }
            router.push(result.published ? `/competitions/${result.id}` : '/competitions/manage'); router.refresh();
        } catch { setError('저장하지 못했습니다. 입력 내용은 유지되며, 잠시 후 다시 시도해주세요.'); setPending(false); }
    }}>
        <section className={styles.formSection}><h2>01 · 대회 기본정보</h2><div className={styles.formGrid}>
            <div className={styles.wide}>{field('title','대회명',120,'예: ○○볼링센터 오픈 대회')}</div>
            {field('organizer','주관사',100)}{field('format','대회형식',100,'예: 개인전 · 3게임 합산')}
            {field('venue','대회장소',200,'볼링장명과 주소를 함께 입력하세요')}{field('fee','참가비',100,'예: 50,000원 / 무료')}
        </div></section>
        <section className={styles.formSection}><h2>02 · 접수와 대회 일정</h2><div className={styles.formGrid}>
            {dateField('registrationStartDate','접수 시작일')}{dateField('registrationEndDate','접수 마감일')}
            {dateField('startDate','대회 시작일')}{dateField('endDate','대회 종료일')}
            <div className={styles.wide}>{field('eventTime','시간',120,'예: 09:00 집결 · 10:00 경기 시작 / A조 09:00, B조 13:00')}</div>
        </div><p className={styles.fieldHint}>하루 일정은 시작일·종료일을 동일하게 입력하세요. 날짜와 시간은 한국 현지 기준으로 표시합니다.</p></section>
        <section className={styles.formSection}><h2>03 · 대회 안내와 요강</h2><div className={styles.formGrid}>
            <label className={styles.wide}>대회 안내<textarea name="description" defaultValue={initial?.description} maxLength={5000} placeholder="대회 소개, 참가 대상, 접수 방법, 문의처 등" required /></label>
            <label className={styles.wide}>대회 요강<textarea name="rules" defaultValue={initial?.rules} maxLength={10000} placeholder="경기 방식, 참가 조건, 핸디캡, 시상, 취소·환불 규정 등을 입력하세요." required /></label>
            <label>접수 링크 (선택)<input name="registrationUrl" type="url" defaultValue={initial?.registrationUrl} placeholder="https://..." maxLength={2048} /><span className={styles.fieldHint}>사용자가 접수 페이지로 바로 이동합니다.</span></label>
            <label>관련 링크 (선택)<input name="relatedUrl" type="url" defaultValue={initial?.relatedUrl} placeholder="https://..." maxLength={2048} /><span className={styles.fieldHint}>주관사 원문·요강 파일 등으로 연결할 수 있습니다.</span></label>
        </div></section>
        <label className={styles.publish}><input type="checkbox" name="published" defaultChecked={initial?.published ?? false}/><div>사용자에게 공개<span>선택하면 목록·달력·홈에서 바로 조회됩니다. 해제하면 슈퍼어드민 관리 화면에만 보관됩니다.</span></div></label>
        {error && <p className={portal.error} role="alert">{error}</p>}
        <div className={portal.actions}><button className={portal.button} disabled={pending}>{pending ? '저장 중…' : initial ? '수정 저장' : '대회정보 등록'}</button><Link className={portal.secondary} href="/competitions/manage">취소</Link></div>
    </form>;
}
