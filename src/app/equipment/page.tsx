import Link from 'next/link';
import type {Metadata} from 'next';
import prisma from '@/lib/prisma';
import {PUBLIC_ORIGIN} from '@/lib/public-web';
import {searchText,searchPage} from '@/lib/portal-params';
import {EQUIPMENT_CATEGORIES,EQUIPMENT_TYPES,equipmentCategory} from '@/lib/equipment';
import {publicEquipmentWhere} from '@/lib/equipment-server';
import {communityViewer} from '@/lib/community-access';
import EquipmentCards from '@/components/equipment/EquipmentCards';
import EquipmentReferences from '@/components/equipment/EquipmentReferences';
import ManufacturerEquipment from '@/components/equipment/ManufacturerEquipment';
import {EquipmentReadingGuide} from '@/components/public/ReadingGuides';
import portal from '@/components/portal/Portal.module.css';
import styles from '@/components/equipment/Equipment.module.css';
export const metadata:Metadata={title:'볼링 용품 소개와 사용 후기 | 볼링매니저',description:'볼링공·볼링화·가방·액세서리의 제품 소개와 회원 사용 후기를 찾아보고 직접 경험을 나눠보세요.',alternates:{canonical:PUBLIC_ORIGIN+'/equipment'}};
export default async function EquipmentPage({searchParams}:{searchParams:Promise<{q?:string|string[];category?:string|string[];type?:string|string[];page?:string|string[];productPage?:string|string[]}>}) {
    const params=await searchParams,q=searchText(params.q),candidate=searchText(params.category),category=equipmentCategory(candidate)?candidate:'',type=EQUIPMENT_TYPES.some(t=>t.id===searchText(params.type))?searchText(params.type):'',page=searchPage(params.page),productPage=searchPage(params.productPage);
    const where=publicEquipmentWhere(q,category,type);
    const [posts,count,total,intros,reviews,viewer]=await Promise.all([
        prisma.communityPost.findMany({
            where,take:12,skip:(page-1)*12,orderBy:[{createdAt:'desc'},{id:'desc'}],
            include:{author:{select:{name:true}},_count:{select:{comments:{where:{status:'PUBLISHED'}}}}},
        }),
        prisma.communityPost.count({where}),
        prisma.communityPost.count({where:publicEquipmentWhere()}),
        prisma.communityPost.count({where:publicEquipmentWhere('','','INTRO')}),
        prisma.communityPost.count({where:publicEquipmentWhere('','','REVIEW')}),
        communityViewer(),
    ]);
    const href=(next:Partial<{category:string;type:string;page:string}>)=>'/equipment?'+new URLSearchParams({q,category,type,page:'1',productPage:('category' in next || 'type' in next) ? '1' : String(productPage),...next});
    return <div className={portal.page}><div className={portal.inner}><header className={`${portal.headline} ${styles.heading}`}><p className={portal.eyebrow}>GEAR NOTE · FROM BOWLERS</p><h1>볼링 용품, 함께 알아보세요.</h1><p>새로운 장비의 소개부터 직접 써본 후기까지. 볼링공·신발·가방과 관리용품의 경험을 나눠보세요.</p></header>
        <nav className={portal.tabs} aria-label="용품 페이지 안내"><a href={type === 'REVIEW' ? href({type:'INTRO'}) + '#manufacturer-equipment' : '#manufacturer-equipment'}>제조사·판매처 제품 정보</a><a href="#equipment-posts">회원 소개·후기</a><a href="#equipment-checklist">구매 전 비교 체크리스트</a></nav>
        <div className={styles.toolbar}><div className={styles.counts}><span><strong>{total}</strong>개의 이야기</span><span>제품 소개 {intros}</span><span>사용 후기 {reviews}</span></div><div className={portal.actions}><Link className={portal.button} href="/equipment/new">+ 소개 · 후기 등록</Link>{viewer?.role==='SUPER_ADMIN'&&<Link className={portal.secondary} href="/community/moderation">신고 · 숨김 관리</Link>}</div></div>
        <nav className={portal.tabs} aria-label="용품 종류"><Link href={href({category:''})} aria-current={!category?'page':undefined}>전체 용품</Link>{EQUIPMENT_CATEGORIES.map(c=><Link key={c.id} href={href({category:c.id})} aria-current={category===c.id?'page':undefined}>{c.label}</Link>)}</nav>
        <div className={styles.toolbar}><nav className={portal.tabs} aria-label="용품 글 유형"><Link href={href({type:''})} aria-current={!type?'page':undefined}>모든 이야기</Link>{EQUIPMENT_TYPES.map(t=><Link key={t.id} href={href({type:t.id})} aria-current={type===t.id?'page':undefined}>{t.label}</Link>)}</nav></div>
        <form action="/equipment" className={portal.search}><input type="hidden" name="category" value={category}/><input type="hidden" name="type" value={type}/><input name="q" type="search" defaultValue={q} aria-label="용품 제목·브랜드·모델 검색" placeholder="제목, 브랜드 또는 모델명으로 검색하세요" maxLength={100}/><button className={portal.button}>검색</button></form>
        <ManufacturerEquipment q={q} category={category} type={type} page={productPage} memberPage={page}/>
        <h2 id="equipment-posts" className={portal.guideSection}>회원 소개·후기</h2><p className={portal.meta}>회원 글 검색 결과 {count}개 · {page}페이지</p>{posts.length?<EquipmentCards posts={posts}/>:<div className={portal.empty}><strong>{q||category||type?'조건에 맞는 용품 이야기가 없습니다.':'아직 등록된 용품 이야기가 없습니다.'}</strong><p>제품 소개나 직접 사용한 경험을 처음으로 나눠주세요.</p><Link href="/equipment/new">소개 · 후기 작성하기 →</Link></div>}
        <nav className={portal.pager} aria-label="용품 페이지">{page>1&&<Link className={portal.secondary} href={href({page:String(page-1)})}>이전</Link>}{page*12<count&&<Link className={portal.secondary} href={href({page:String(page+1)})}>다음</Link>}</nav>
        <aside className={portal.notice}>회원 소개·후기 목록은 회원이 작성한 글입니다. 제조사 자료 정리와 아래 구매 체크리스트는 별도의 편집 콘텐츠입니다. 사용 환경에 따라 경험이 다를 수 있으며, 사양·국내 출시·가격·재고는 제조사와 판매처의 최신 안내를 확인해주세요.</aside>
        <EquipmentReadingGuide/><EquipmentReferences/>
    </div></div>;
}
