'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {saveEquipmentPost} from '@/app/actions/equipment';
import {EQUIPMENT_CATEGORIES,EQUIPMENT_TYPES} from '@/lib/equipment';
import portal from '@/components/portal/Portal.module.css';
import styles from './Equipment.module.css';
type Initial={id:string;title:string;content:string;equipmentType:string|null;equipmentCategory:string|null;equipmentBrand:string|null;equipmentModel:string|null;equipmentLink:string|null};
export default function EquipmentEditor({initial}:{initial?:Initial}) {
    const router=useRouter(),[pending,setPending]=useState(false),[error,setError]=useState('');
    return <form className={portal.form} onSubmit={async event=>{
        event.preventDefault();if(pending)return;const form=new FormData(event.currentTarget),value=(key:string)=>String(form.get(key)??'');setPending(true);setError('');
        try{const result=await saveEquipmentPost(initial?.id??null,{title:value('title'),content:value('content'),equipment:{type:value('type'),category:value('category'),brand:value('brand'),model:value('model'),link:value('link')}});if(result.error){setError(result.error);setPending(false);return;}router.push(`/equipment/${result.id}`);router.refresh();}
        catch{setError('저장하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도해주세요.');setPending(false);}
    }}>
        <section className={styles.formSection}><h2>어떤 용품을 이야기하나요?</h2><div className={styles.fields}>
            <label>글 유형<select name="type" defaultValue={initial?.equipmentType??'REVIEW'} required>{EQUIPMENT_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
            <label>용품 종류<select name="category" defaultValue={initial?.equipmentCategory??'BALL'} required>{EQUIPMENT_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
            <label>브랜드 (선택)<input name="brand" defaultValue={initial?.equipmentBrand??''} maxLength={60} placeholder="제조사·브랜드 이름"/></label>
            <label>제품명 · 모델명<input name="model" defaultValue={initial?.equipmentModel??''} maxLength={120} required placeholder="소개하거나 사용한 모델을 입력하세요"/></label>
            <label className={styles.wide}>관련 링크 (선택)<input type="url" name="link" defaultValue={initial?.equipmentLink??''} maxLength={2048} placeholder="https://..."/><span className={styles.hint}>제조사 제품 설명이나 참고자료를 연결할 수 있습니다.</span></label>
        </div></section>
        <section className={styles.formSection}><h2>소개와 경험을 들려주세요</h2><div className={styles.fields}>
            <label className={styles.wide}>제목<input name="title" defaultValue={initial?.title} minLength={2} maxLength={100} required placeholder="다른 볼러가 내용을 알아볼 수 있는 제목"/></label>
            <label className={styles.wide}>내용<textarea name="content" defaultValue={initial?.content} minLength={10} maxLength={10000} required placeholder={'제품 소개: 확인한 특징과 출처를 적어주세요.\n사용 후기: 사용한 무게·기간·레인 환경, 좋았던 점과 아쉬운 점을 함께 적어주세요.'}/></label>
        </div><p className={styles.hint}>직접 사용하지 않았다면 사용 후기로 작성하지 마세요. 협찬·판매 목적은 본문에 밝혀주세요. 다른 사람의 사진·글을 무단으로 복사하지 마세요.</p></section>
        <p className={portal.notice}>공개 게시글입니다. 댓글로 이야기를 나눌 수 있으며, 문제가 있는 글은 신고·숨김 처리될 수 있습니다. 새 글은 1분 간격으로 등록할 수 있습니다.</p>
        {error&&<p className={portal.error} role="alert">{error}</p>}<div className={portal.actions}><button className={portal.button} disabled={pending}>{pending?'저장 중…':initial?'수정 저장':'소개 · 후기 등록'}</button><Link className={portal.secondary} href={initial?`/equipment/${initial.id}`:'/equipment'}>취소</Link></div>
    </form>;
}
