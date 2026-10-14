'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { addCommunityComment, deleteCommunityPost, deleteCommunityComment, updateCommunityComment, reportCommunityPost, moderateCommunityPost } from '@/app/actions/community';
import { communityDate } from '@/lib/community';
import styles from '@/components/portal/Portal.module.css';
import board from './Community.module.css';

type Comment={id:string;content:string;createdAt:string;updatedAt:string;author:{id:string;name:string}};
export default function CommunityDiscussion({postId,canEdit,isAdmin,isLoggedIn,userId,comments,basePath='/community'}:{postId:string;canEdit:boolean;isAdmin:boolean;isLoggedIn:boolean;userId?:string;comments:Comment[];basePath?:'/community'|'/equipment'}) {
    const router=useRouter();const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');const [comment,setComment]=useState('');const [reason,setReason]=useState('');
    const [editing,setEditing]=useState<string|null>(null);const [draft,setDraft]=useState('');
    async function run(action:()=>Promise<void>,done?:()=>void){if(busy)return;setBusy(true);setError('');setMessage('');try{await action();done?.();router.refresh();}catch{setError('요청을 처리하지 못했습니다. 권한과 입력 내용을 확인하고 다시 시도해주세요.');}finally{setBusy(false);}}
    return <>
        <div className={styles.actions}>{canEdit&&<><Link className={styles.secondary} href={`${basePath}/${postId}/edit`}>글 수정</Link><button className={styles.secondary} disabled={busy} onClick={()=>{if(confirm('이 글을 삭제하시겠습니까?'))void run(()=>deleteCommunityPost(postId),()=>router.push(basePath));}}>글 삭제</button></>}{isAdmin&&<button disabled={busy} className={styles.secondary} onClick={()=>{if(confirm('이 글을 공개 목록에서 숨기시겠습니까?'))void run(()=>moderateCommunityPost(postId,true),()=>router.push('/community/moderation'));}}>관리자 숨김</button>}</div>
        {error&&<p className={styles.error} role="alert">{error}</p>}{message&&<p className={styles.success} role="status">{message}</p>}
        <section className={styles.comments}><h2>댓글 {comments.length}</h2>
            {comments.length?comments.map(c=><article className={styles.comment} key={c.id}><div className={styles.commentHead}><div><strong>{c.author.name}</strong><span className={styles.meta}>{communityDate(c.createdAt)}{c.updatedAt!==c.createdAt?' · 수정됨':''}</span></div>{(c.author.id===userId||isAdmin)&&<div className={board.commentActions}><button type="button" className={styles.textButton} disabled={busy} aria-label={`${c.author.name} 댓글 수정`} onClick={()=>{setEditing(c.id);setDraft(c.content);setError('');}}>수정</button><button type="button" className={styles.textButton} disabled={busy} onClick={()=>{if(confirm('댓글을 삭제하시겠습니까?'))void run(()=>deleteCommunityComment(c.id));}}>삭제</button></div>}</div>{editing===c.id?<form className={board.editForm} onSubmit={e=>{e.preventDefault();void run(()=>updateCommunityComment(c.id,draft,c.updatedAt),()=>{setEditing(null);setMessage('댓글을 수정했습니다.');});}}><label htmlFor={`edit-${c.id}`}>댓글 수정 내용</label><textarea id={`edit-${c.id}`} value={draft} onChange={e=>setDraft(e.target.value)} maxLength={2000} required/><div className={styles.actions}><button className={styles.button} disabled={busy}>수정 저장</button><button type="button" disabled={busy} className={styles.secondary} onClick={()=>setEditing(null)}>취소</button></div></form>:<p>{c.content}</p>}</article>):<div className={styles.empty}>아직 댓글이 없습니다. 첫 의견을 남겨보세요.</div>}
            {isLoggedIn?<form onSubmit={e=>{e.preventDefault();void run(()=>addCommunityComment(postId,comment),()=>setComment(''));}}><label htmlFor="community-comment">댓글 작성</label><textarea id="community-comment" value={comment} onChange={e=>setComment(e.target.value)} placeholder="서로를 존중하는 대화를 나눠주세요." maxLength={2000} required/><div className={styles.actions}><button disabled={busy} className={styles.button}>댓글 등록</button></div></form>:<p className={styles.notice}>댓글을 남기려면 <Link href="/login">로그인</Link>해주세요.</p>}
        </section>
        {isLoggedIn&&<details className={styles.notice}><summary>문제가 있는 글 또는 댓글 신고</summary><form onSubmit={e=>{e.preventDefault();void run(()=>reportCommunityPost(postId,reason),()=>{setMessage('신고가 접수됐습니다. 관리자가 내용을 확인합니다.');setReason('');});}}><label htmlFor="report-reason">신고 이유 · 댓글 신고는 작성자와 내용을 알려주세요.</label><textarea id="report-reason" minLength={5} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} required/><button className={styles.secondary} disabled={busy}>신고 접수</button></form></details>}
    </>;
}
