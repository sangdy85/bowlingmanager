import Link from 'next/link';
import { PRODUCT_SPEC_NOTES, productSpecNote } from '@/lib/product-spec-notes';
import styles from './ProductSpecNotes.module.css';

export default function ProductSpecNotes({slug}:{slug:string}) {
  const note=productSpecNote(slug);
  if(!note)return null;
  return <section className={styles.section} aria-labelledby="verified-specs">
    <p className={styles.credit}>추가 자료 확인 · BowlingManager 편집 · {note.checkedAt}</p>
    <h2 id="verified-specs">이미지 속 사양을 표로 읽기</h2>
    <p>로드필드 공식 상세 이미지의 숫자를 무게별로 옮겼습니다. 아래 해설은 공개 사양에 대한 편집 설명이며 실투구 시험이나 사용 후기가 아닙니다.</p>
    <dl className={styles.facts}><div><dt>코어</dt><dd>{note.core}</dd></div><div><dt>커버 표기</dt><dd>{note.coverstock}</dd></div><div><dt>출고 표면</dt><dd>{note.finish}</dd></div></dl>
    <div className={styles.scroll}><table><caption>{note.model} 무게별 미지공 사양</caption><thead><tr><th scope="col">무게</th><th scope="col">RG</th><th scope="col">Diff</th><th scope="col">MB (별도 표기)</th></tr></thead><tbody>{note.weights.map(row=><tr key={row.lb}><th scope="row">{row.lb} lb</th><td>{row.rg}</td><td>{row.diff}</td><td>{row.mb??'원문에 별도 표기 없음'}</td></tr>)}</tbody></table></div>
    <p><a href={note.sourceUrl} target="_blank" rel="noopener noreferrer">제조사 상세 사양 이미지 확인 ↗</a> · <Link href="/guide/bowling-ball-specifications-coverstock-core-rg-diff-guide">RG·Diff·커버·코어 용어 해설 →</Link></p>
    <h3>이 모델을 비교할 때 볼 점</h3>{note.interpretation.map(text=><p key={text}>{text}</p>)}
    <h3>같은 15lb끼리 비교</h3>
    <div className={styles.scroll}><table><caption>SWAG 3종 공식 사양 비교 · 모두 15lb 기준</caption><thead><tr><th scope="col">모델</th><th scope="col">RG</th><th scope="col">Diff</th><th scope="col">출고 표면</th></tr></thead><tbody>{PRODUCT_SPEC_NOTES.map(other=>{const row=other.weights.find(weight=>weight.lb===15)!;return <tr key={other.slug}><th scope="row">{other.slug===slug?other.model:<Link href={'/equipment/products/'+other.slug}>{other.model}</Link>}</th><td>{row.rg}</td><td>{row.diff}</td><td>{other.finish}</td></tr>;})}</tbody></table></div>
    <p className={styles.credit}>동일 무게의 코어 수치를 비교하는 표입니다. 커버·표면·지공·투구·레인 조건이 달라 수치만으로 실제 반응의 우열을 정하지 않습니다. 공인 여부·재고·가격은 이 표에서 확인한 항목이 아닙니다.</p>
  </section>;
}
