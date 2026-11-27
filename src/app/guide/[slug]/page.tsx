import { findMergedGuideDestination, findPublishedGuideArticle, PUBLISHED_GUIDE_ARTICLES } from '@/lib/guide-data';
import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Metadata } from 'next';
import { PUBLIC_ORIGIN, safeContentUrl } from '@/lib/public-web';
import PublicNav from '@/components/public/PublicNav';
import AppGrowthCta from '@/components/public/AppGrowthCta';
import styles from '@/components/public/Public.module.css';
interface Props { params: Promise<{ slug: string }> }
export async function generateStaticParams() { return PUBLISHED_GUIDE_ARTICLES.map(article => ({slug:article.slug})); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
 const {slug}=await params; const mergedInto=findMergedGuideDestination(slug);
 if(mergedInto){const article=findPublishedGuideArticle(mergedInto);return {title:article?.title||'통합된 볼링 가이드',robots:{index:false,follow:true},alternates:{canonical:PUBLIC_ORIGIN+'/guide/'+mergedInto}};}
 const article=findPublishedGuideArticle(slug);
 if(!article) return {title:'가이드를 찾을 수 없습니다',robots:{index:false,follow:true}};
 return {title:article.title+' | 볼링매니저',description:article.description,alternates:{canonical:PUBLIC_ORIGIN+'/guide/'+article.slug}};
}
export default async function GuideDetailPage({ params }: Props) {
 const {slug}=await params; const mergedInto=findMergedGuideDestination(slug); if(mergedInto) permanentRedirect('/guide/'+mergedInto);
 const article=findPublishedGuideArticle(slug); if(!article) notFound();
 const toc=article.content.split('\n').flatMap((line,index)=>/^##\s/.test(line)?[{id:'section-'+(index+1),label:line.replace(/^##\s+/,'')}]:[]);
 const relatedArticles=(article.relatedArticles??[]).flatMap(relatedSlug=>{
  const related=findPublishedGuideArticle(relatedSlug);
  return related&&related.slug!==slug?[related]:[];
 });
 return <div className={styles.surface}><PublicNav /><div className={styles.article}>
 <p className={styles.tag}><Link href="/guide">가이드</Link> / {article.category}</p>
 <header><h1>{article.title}</h1><p>{article.description}</p><p className={styles.tag}>게시일 {article.date} · 편집일 {article.updatedAt||article.date} · {article.readTime}</p>
 <p className={styles.tag}>BowlingManager에 게시된 이용 안내입니다. <Link href="/about#standards">작성 기준 및 정정 문의</Link></p></header>
 <nav aria-label="글 목차" className={styles.notice}><strong>이 글에서 살펴볼 내용</strong><ol>{toc.map(item=><li key={item.id}><a href={'#'+item.id}>{item.label}</a></li>)}</ol></nav>
 <article><Markdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={safeContentUrl} components={{
 h2:({node,children})=><h2 id={'section-'+node?.position?.start.line}>{children}</h2>,
 h3:({node,children})=><h3 id={'section-'+node?.position?.start.line}>{children}</h3>,
 table:({children})=><div className={styles.tableScroll} tabIndex={0} role="region" aria-label="가이드 표, 좌우로 스크롤 가능"><table>{children}</table></div>,
 a:({href,children})=>href?<a href={href} rel={href.startsWith('https:')?'noopener noreferrer':undefined}>{children}</a>:<span>{children}</span>
 }}>{article.content}</Markdown></article>
 <AppGrowthCta source="guide" variant="compact" />
 <section className={styles.documentInfo} aria-labelledby="document-info-heading">
  <h2 id="document-info-heading">문서 정보</h2>
  <dl className={styles.documentMeta}><div><dt>마지막 검토</dt><dd><time dateTime={article.lastReviewed}>{article.lastReviewed}</time></dd></div></dl>
  {article.references?.length?<div><h3>참고자료</h3><ul className={styles.sourceList}>{article.references.map(source=>{
   const href=safeContentUrl(source.url);
   const sourceMeta=[source.publisher,source.version&&'판본 '+source.version,source.publishedAt&&'발행 '+source.publishedAt].filter(Boolean).join(' · ');
   return <li key={source.url}><p>{href?<a href={href} rel="noopener noreferrer">{source.title}</a>:source.title}</p>{sourceMeta&&<p className={styles.sourceMeta}>{sourceMeta}</p>}<p><strong>지원 범위:</strong> {source.scope}</p></li>;
  })}</ul></div>:null}
  {article.reviewNote?<div><h3>검토 범위</h3><p>{article.reviewNote}</p></div>:null}
  <div><h3>관련 글</h3><ul>{relatedArticles.map(related=><li key={related.slug}><Link href={'/guide/'+related.slug}>{related.title}</Link></li>)}</ul></div>
  {article.relatedResources?.length?<div><h3>관련 도구</h3><ul>{article.relatedResources.map(resource=>{
   const href=safeContentUrl(resource.url);
   return href?<li key={resource.url}><Link href={href}>{resource.title}</Link>{resource.description?<p>{resource.description}</p>:null}</li>:null;
  })}</ul></div>:null}
  <div><h3>내용 정정</h3><p>이 글에서 잘못된 내용이나 최신 자료와 다른 부분을 발견했다면 <Link href="/inquiry">문의 페이지</Link>를 통해 알려주세요.</p></div>
 </section>
 </div></div>;
}
