'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { saveCommunityPost } from '@/app/actions/community';
import { COMMUNITY_CATEGORIES } from '@/lib/community';
import styles from '@/components/portal/Portal.module.css';
import board from './Community.module.css';

export default function CommunityEditor({ initial,defaultCategory='FREE' }: { initial?: { id:string; category:string; title:string; content:string };defaultCategory?:string }) {
    const router=useRouter();
    const [pending,setPending]=useState(false);
    const [error,setError]=useState('');
    const [category,setCategory]=useState(initial?.category??defaultCategory);
    return <form className={`${styles.form} ${board.formCard}`} onSubmit={async event=>{
        event.preventDefault(); if(pending)return;
        const form=new FormData(event.currentTarget); setPending(true);setError('');
        try {const post=await saveCommunityPost(initial?.id??null,{category:String(form.get('category')),title:String(form.get('title')),content:String(form.get('content'))});router.push(`/community/${post.id}`);router.refresh();}
        catch {setError('등록하지 못했습니다. 입력 내용을 확인하고 잠시 후 다시 시도해주세요.');setPending(false);}
    }}>
        <label>게시판<select name="category" value={category} onChange={e=>setCategory(e.target.value)} required>{COMMUNITY_CATEGORIES.filter(c=>c.id!=='EQUIPMENT'||initial?.category==='EQUIPMENT').map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <p className={board.tip}>{category==='QUESTION'?'어떤 상황에서 어려웠는지, 시도한 방법과 궁금한 점을 함께 적어주세요.':category==='TOURNAMENT'?'참가 경험이나 대회 소식을 나눠주세요. 일정과 접수 조건은 주관사의 원문 링크로 확인할 수 있게 적어주세요.':'경기에서 느낀 점, 연습 이야기, 동호회 소식을 자유롭게 나눠주세요.'} 용품 소개·후기는 <Link href="/equipment/new">용품 글쓰기 →</Link></p>
        <label>제목<input name="title" defaultValue={initial?.title} placeholder="다른 볼러에게 전하고 싶은 이야기는?" minLength={2} maxLength={100} required/></label>
        <label>내용<textarea name="content" defaultValue={initial?.content} placeholder="질문에는 상황을, 사용기에는 장비와 사용 환경을 함께 적어주세요." minLength={10} maxLength={10000} required/></label>
        <p className={styles.notice}>공개 게시판입니다. 개인정보·비밀번호를 적지 마세요. 비방, 도배, 무단 광고는 숨김 처리될 수 있습니다. 협찬이나 판매 목적이 있으면 밝혀주세요. 새 글은 1분 간격으로 등록할 수 있습니다.</p>
        {error&&<p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}><button className={styles.button} disabled={pending}>{pending?'저장 중…':initial?'수정 저장':'글 등록'}</button><Link className={styles.secondary} href={initial?`/community/${initial.id}`:'/community'}>취소</Link></div>
    </form>;
}
