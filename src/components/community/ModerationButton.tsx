'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { moderateCommunityPost } from '@/app/actions/community';
import styles from '@/components/portal/Portal.module.css';
export default function ModerationButton({id,hidden}:{id:string;hidden:boolean}) {
    const [busy,setBusy]=useState(false);const [error,setError]=useState('');const router=useRouter();
    return <><button className={styles.secondary} disabled={busy} onClick={async()=>{if(!confirm(hidden?'이 글을 다시 공개하시겠습니까?':'이 글을 숨기시겠습니까?'))return;setBusy(true);try{await moderateCommunityPost(id,!hidden);router.refresh();}catch{setError('처리하지 못했습니다. 관리자 권한을 확인해주세요.');}finally{setBusy(false);}}}>{hidden?'다시 공개':'숨김 처리'}</button>{error&&<p role="alert" className={styles.error}>{error}</p>}</>;
}
