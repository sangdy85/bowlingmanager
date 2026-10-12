'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { kingPerfectCommand, kingPerfectMemberSearch } from '@/app/actions/king-perfect';
import type { getKingPerfectAdmin } from '@/lib/king-perfect/service';
import { STAGES, type Rules, type Stage } from '@/lib/king-perfect/rules';
import styles from './KingPerfectManager.module.css';

type Data = Awaited<ReturnType<typeof getKingPerfectAdmin>>;
type Entry = Data['entries'][number];
type Match = Data['matches'][number];
const tabs = ['현황','진행요약','설정','일정운영','참가자','레인배정','점수 입력','사이드게임','최종 결과','행운권'];
const labels: Record<string,string> = { QUALIFYING_OPEN:'예선 접수 중', QUALIFYING_CLOSED:'예선 마감', QUALIFIERS_CONFIRMED:'24명 확정', ROUND1_READY:'1R 준비', ROUND1_ACTIVE:'1R 진행', ROUND1_CONFIRMED:'1R 확정', ROUND2_READY:'2R 준비', ROUND2_ACTIVE:'2R 진행', ROUND2_CONFIRMED:'2R 확정', FINAL_READY:'결승 준비', FINAL_ACTIVE:'결승 진행', FINISHED:'대회 종료', ROUND1:'1R', ROUND2:'2R', FINAL:'결승' };
const won = (n: number) => n.toLocaleString('ko-KR') + '원';
// Avoid Node/Chromium ICU spacing differences during hydration; Korea is UTC+09:00.
const date = (d: Date | string) => new Date(+new Date(d) + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
type Run = (action: string, data?: Record<string,unknown>, reason?: string) => Promise<boolean>;
function Form({ children, onSubmit, label = '저장' }: { children: React.ReactNode; onSubmit: (f: FormData) => Promise<unknown>; label?: string }) {
  return <form onSubmit={async e => { e.preventDefault(); await onSubmit(new FormData(e.currentTarget)); }}>{children}<button type="submit">{label}</button></form>;
}
function ids(value: FormDataEntryValue | null) { return String(value || '').split(/[\s,]+/).filter(Boolean); }
function MemberSelect({ entries, name = 'entryId' }: { entries: Entry[]; name?: string }) {
  return <select name={name} aria-label="참가자" required>{entries.map(e => <option key={e.id} value={e.id}>{e.name} · {e.id.slice(-6)}</option>)}</select>;
}
export default function KingPerfectManager({ data }: { data: Data }) {
  const [tab, setTab] = useState(0), [feedback, setFeedback] = useState(''), [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [reason, setReason] = useState(''), [query, setQuery] = useState('');
  const [members, setMembers] = useState<Awaited<ReturnType<typeof kingPerfectMemberSearch>>>([]);
  const [remaining, setRemaining] = useState('');
  const router = useRouter();
  useEffect(() => { const tick = () => { const minutes = Math.floor((+new Date(data.startsAt) - Date.now()) / 60000); setRemaining(minutes > 0 ? Math.floor(minutes / 1440) + '일 ' + Math.floor(minutes % 1440 / 60) + '시간 ' + minutes % 60 + '분' : '본선 시작 시각 경과'); }; tick(); const timer = setInterval(tick, 60000); return () => clearInterval(timer); }, [data.startsAt]);
  const run: Run = async (action, body = {}, fallback = '') => {
    if (busy || refreshing) return false;
    const note = reason.trim() || fallback;
    if (note.length < 2) { setFeedback('작업 사유를 먼저 입력하세요.'); return false; }
    setBusy(true); setFeedback('');
    try {
      const result = await kingPerfectCommand(data.id, { action, requestKey: crypto.randomUUID(), revision: data.revision, reason: note, data: body });
      if (!result.success) throw new Error(result.error || '작업 실패');
      setFeedback('저장했습니다.'); startTransition(() => router.refresh()); return true;
    } catch (e) { setFeedback(e instanceof Error ? e.message : '저장 실패. 새로고침 후 확인하세요.'); return false; }
    finally { setBusy(false); }
  };
  const name = (id: string) => data.entries.find(e => e.id === id)?.name || id;
  const fees = data.entries.flatMap(e => e.fees.map(f => ({ ...f, name:e.name })));
  const seedEntries = data.entries.filter(e => e.seed).sort((a,b) => a.seed!.position-b.seed!.position);
  const totalAttempts = data.entries.reduce((n,e) => n + e.attempts.filter(a => !a.voided).length, 0);
  const active = data.matches.filter(m => data.state === m.stage + '_ACTIVE');
  const missing = active.reduce((n,m) => n + m.seats.reduce((v,s) => v + data.rules.games[m.stage as Stage] - s.games.filter(g => g.raw !== null).length, 0), 0);
  const download = async () => {
    try {
      const XLSX = await import('xlsx'); const book = XLSX.utils.book_new();
      const add = (label: string, rows: unknown[]) => XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows as Record<string,unknown>[]), label);
      add('예선 순위', data.ranking.map(r => ({ 순위:r.rank, 이름:r.name, 참가자ID:r.entryId, 핸디:r.attempt.handicap, 점수:r.attempt.raw, 환산:r.attempt.converted, 동점:r.tied ? '판정 필요':'', 확정시드:data.entries.find(e => e.id === r.entryId)?.seed?.position ?? '' })));
      add('대진 및 전체 결과', data.matches.flatMap(m => m.seats.map(s => ({ 단계:labels[m.stage], 경기:m.slot, 레인:JSON.parse(m.lanes).join('·'), 참가자ID:s.entryId, 이름:name(s.entryId), 핸디:s.handicap, 점수:s.games.map(g => g.raw ?? '').join('/'), 원점수합:s.rawTotal, 환산합:s.total, 순위:s.rank, 확정:m.confirmed }))));
      add('참가비', fees.map(f => ({ 이름:f.name, 단계:f.stage, 금액:f.amount, 상태:f.status })));
      add('행운권', data.entries.filter(e => e.luckyWin).map(e => ({ 이름:e.name, 참가자ID:e.id })));
      if (data.settlement) add('시상', data.settlement.winners);
      XLSX.writeFile(book, 'KING-PERFECT-' + data.month + '.xlsx');
    } catch { setFeedback('엑셀 다운로드에 실패했습니다.'); }
  };
  const ranking = <div className={styles.scroll}><table><thead><tr><th>순위</th><th>이름 / 참가자 ID</th><th>핸디</th><th>점수</th><th>환산</th><th>선정 상태</th></tr></thead><tbody>{data.ranking.map(r => <tr key={r.entryId}><td>{r.rank}{r.tied ? ' (동점)' : ''}</td><td>{r.name}<small>{r.entryId}</small></td><td>{r.attempt.handicap}</td><td>{r.attempt.raw}</td><td><strong>{r.attempt.converted}</strong></td><td>{data.entries.find(e => e.id===r.entryId)?.seed ? '본선 확정' : r.rank<=24 ? '진출 후보 · 미확정':'대기'}</td></tr>)}</tbody></table></div>;
  const bracket = <div className={styles.bracket}>{STAGES.map(stage => <section key={stage}><h3>{labels[stage]}</h3>{data.matches.filter(m=>m.stage===stage).map(m=><article key={m.id} className={styles.match} data-table={m.tableIndex}><h4>{stage==='FINAL'?'결승':String.fromCharCode(65+m.tableIndex)+' 테이블'} · 경기 {m.slot} · {JSON.parse(m.lanes).join('·')}레인</h4>{m.seats.map(s=><p key={s.id}><b>{name(s.entryId)}</b><span>{s.games.map(g=>g.raw??'—').join(' / ') || '미입력'} {s.rank === 1 && m.confirmed ? '🏆' : ''}</span></p>)}<small>{m.confirmed?'경기 확정':'미확정'}{stage==='ROUND1' && ' → 2R '+String.fromCharCode(65+data.rules.round2Mapping.findIndex(g=>g.includes(m.slot)))+' 테이블'}</small></article>)}</section>)}</div>;
  return <main className={styles.page}>
    <header className={styles.hero}><span>♛ KING PERFECT</span><h1>{data.name} <small>{data.month}</small></h1><p>{labels[data.state]} · 본선 24명 → 12명 → 4명</p><p>{date(data.startsAt)} (Asia/Seoul) · {remaining}</p><p>연습투구 {date(data.practiceAt)}</p></header>
    <nav className={styles.tabs} aria-label="킹퍼펙트 운영 탭">{tabs.map((label,i)=><button key={label} type="button" aria-current={tab===i?'page':undefined} onClick={()=>setTab(i)}>{i+1}. {label}</button>)}</nav>
    <div className={styles.operations}><label>작업 / 변경 사유<input value={reason} onChange={e=>setReason(e.target.value)} placeholder="동점 판정·수정·잠금 해제 사유를 입력" maxLength={500}/></label><button onClick={()=>window.print()}>인쇄 / PDF 저장</button><button onClick={download}>전체 엑셀 다운로드</button><button onClick={()=>router.refresh()}>새로고침</button></div>
    <p role="status" className={styles.feedback}>{busy || refreshing ? '저장 및 갱신 중…' : feedback}</p>
    <fieldset disabled={busy || refreshing} className={styles.body}>
    {tab===0 && <><h2>운영 현황</h2><div className={styles.metrics}>{[['예선 참가자',data.entries.length+'명'],['예선 유효 게임',totalAttempts+'게임'],['본선 확정',seedEntries.length+'/24명'],['예선 발생액',won(fees.filter(f=>f.stage==='QUALIFYING' && !['CANCELLED','REFUNDED'].includes(f.status)).reduce((s,f)=>s+f.amount,0))],['전체 미납',won(fees.filter(f=>f.status==='UNPAID').reduce((s,f)=>s+f.amount,0))]].map(([k,v])=><article key={k}><span>{k}</span><strong>{v}</strong></article>)}</div>
      <div className={styles.notice}><b>다음 운영 작업</b><p>{data.state==='QUALIFYING_OPEN'?'예선 규칙 확인 → 센터 회원 등록 및 자격 승인 → 예선 기록 입력':data.state==='QUALIFYING_CLOSED'?'동점 순서를 판정하고 상위 24명을 확정하세요.':data.state==='FINISHED'?'시상 기준 확인 → 정산 확정 → 행운권 → 결과 공개': '일정운영에서 다음 단계 준비/시작/종료를 진행하세요.'}</p><p>진행 중 누락 점수 {missing}개 / 미확정 경기 {active.filter(m=>!m.confirmed).length}개</p></div><h3>입금 안내</h3><p>{data.rules.bankAccount}</p><p>입금 여부는 관리자가 수동 확인합니다.</p></>}
    {tab===1 && <><h2>진행요약</h2><p>현재: {labels[data.state]} · 누락 점수 {missing}개</p>{bracket}<h3>예선 순위</h3>{ranking}</>}
    {tab===2 && <Settings key={data.revision} rules={data.rules} locked={!['QUALIFYING_OPEN','QUALIFYING_CLOSED'].includes(data.state)} run={run}/>}
    {tab===3 && <><h2>일정운영</h2><p>{date(data.startsAt)} · 접수 시작 {data.rules.registrationStart ? date(data.rules.registrationStart):'상시'} / 종료 {data.rules.registrationEnd ? date(data.rules.registrationEnd):'수동 마감'}</p>
      {data.state==='QUALIFYING_OPEN' && <button onClick={()=>run('CLOSE',{},'예선 접수 마감')}>예선 마감</button>}
      {data.state==='QUALIFYING_CLOSED' && <Form label="상위 24명 확정" onSubmit={f=>run('QUALIFIERS',{tieOrder:ids(f.get('tieOrder'))})}><label>동점자 ID 순서 (앞사람 우선, 쉼표 구분)<input name="tieOrder" placeholder="동점이 없으면 비워두세요"/></label></Form>}
      {STAGES.map(stage=><div className={styles.stageControls} key={stage}><b>{labels[stage]}</b><button disabled={data.state!==({ROUND1:'QUALIFIERS_CONFIRMED',ROUND2:'ROUND1_CONFIRMED',FINAL:'ROUND2_CONFIRMED'}[stage])} onClick={()=>run('GENERATE',{stage},labels[stage]+' 대진 생성')}>대진 생성</button><button disabled={data.state!==stage+'_READY'} onClick={()=>run('START',{stage},labels[stage]+' 시작')}>시작</button><button disabled={data.state!==stage+'_ACTIVE'} onClick={()=>run('END_STAGE',{stage},labels[stage]+' 전체 결과 확정')}>단계 종료/확정</button></div>)}
      <Form label="다음 월 회차 생성" onSubmit={f=>run('NEW_EDITION',{month:f.get('month')},'월별 회차 생성')}><label>대회 월<input type="month" name="month" required/></label></Form>
      <details><summary>확정 잠금 해제 / 이전 단계 수정</summary><p>선택한 단계의 확정을 취소하고 이후 대진·결과·시상·추첨을 초기화합니다. 이전 데이터는 감사 이력에 보존됩니다. 참가비 원장은 유지되므로 취소·환불을 별도로 확인하세요.</p><Form label="사유를 기록하고 잠금 해제" onSubmit={f=>run('REOPEN',{target:f.get('target')})}><select name="target"><option value="QUALIFYING">예선부터 재확정</option>{STAGES.map(s=><option key={s}>{s}</option>)}</select><label><input type="checkbox" required/>영향받는 후속 결과 초기화를 확인했습니다.</label></Form></details>
      <h3>변경 이력 (최근 50건)</h3>{data.audits.map(a=><p key={a.id}>{date(a.createdAt)} · {a.action} · {a.reason} <small>담당자 {a.actorId}</small></p>)}</>}
    {tab===4 && <><h2>참가자</h2><form onSubmit={async e=>{e.preventDefault();try {setMembers(await kingPerfectMemberSearch(data.id,query));} catch(err){setFeedback(err instanceof Error?err.message:'검색 실패');}}}><label>센터 회원 이름<input value={query} onChange={e=>setQuery(e.target.value)} minLength={1} maxLength={50} required/></label><button>검색</button></form>
      {members.map(m=><p key={m.id}>{m.alias||m.User.name} · 핸디 {m.User.handicap??0} <button disabled={data.entries.some(e=>e.memberId===m.id)} onClick={()=>run('REGISTER',{memberId:m.id},'센터 회원 참가 등록')}>등록</button></p>)}
      {data.entries.map(entry=><details key={entry.id}><summary>{entry.name} · {entry.eligibility} {entry.cancelled?'· 취소':''} · 핸디 {entry.handicap}</summary><small>{entry.id}</small><Form label="참가자격 저장" onSubmit={f=>run('ELIGIBILITY',{entryId:entry.id,eligibility:f.get('eligibility'),athlete:f.has('athlete'),cancelled:f.has('cancelled'),handicap:Number(f.get('handicap'))})}><select name="eligibility" defaultValue={entry.eligibility}><option value="PENDING">미확인</option><option value="APPROVED">자격 확인·승인</option><option value="REJECTED">부적격</option></select><label><input type="checkbox" name="athlete" defaultChecked={entry.athlete}/>선수/프로</label><label><input type="checkbox" name="cancelled" defaultChecked={entry.cancelled}/>참가 취소</label><label>상주리그 개인 핸디<input type="number" name="handicap" min={-300} max={300} required defaultValue={entry.handicap}/></label></Form><p>승인은 해당 센터 회원 및 선수·프로 제외 여부를 확인했다는 뜻입니다.</p>
      {entry.attempts.map(a=><Form key={a.id} label="예선 기록 수정" onSubmit={f=>run('EDIT_ATTEMPT',{entryId:entry.id,attemptId:a.id,raw:Number(f.get('raw')),handicap:Number(f.get('handicap')),voided:f.has('voided')})}><small>{date(a.createdAt)} · 환산 {a.converted}</small><label>원점수<input type="number" name="raw" min={0} max={300} defaultValue={a.raw} required/></label><label>핸디<input type="number" name="handicap" min={-300} max={300} defaultValue={a.handicap} required/></label><label><input name="voided" type="checkbox" defaultChecked={a.voided}/>기록 취소</label></Form>)}</details>)}<h3>예선 순위 / 대기자</h3>{!data.rules.qualifyingConfirmed&&<p>규칙 미확정: 최고 기록 기준의 임시 미리보기입니다.</p>}{ranking}</>}
    {tab===5 && <><h2>레인배정</h2><p>1R은 1–22 / 2–23 / 3–24부터 시작하는 지정 대진입니다. 2R 매핑 {data.rules.mappingConfirmed?'관리자 확인 완료':'검증 필요'}</p>{bracket}<h3>확정 시드</h3><div className={styles.seedList}>{seedEntries.map(e=><span key={e.id}>{e.seed!.position}. {e.name} ({e.seed!.converted})</span>)}</div>
      <Form label="두 시드 위치 교체" onSubmit={f=>run('SWAP_SEEDS',{first:f.get('first'),second:f.get('second')})}><MemberSelect entries={seedEntries} name="first"/><MemberSelect entries={seedEntries} name="second"/></Form><p>시드 교체는 24명 확정 후 1R 생성 전에 가능합니다.</p></>}
    {tab===6 && <><h2>점수 입력</h2><Form label="예선 기록 저장 (1,000원 발생)" onSubmit={f=>run('ATTEMPT',{entryId:f.get('entryId'),raw:Number(f.get('raw')),freeGame:false},'예선 유료게임 기록 입력')}><MemberSelect entries={data.entries.filter(e=>e.eligibility==='APPROVED'&&!e.cancelled&&!e.athlete)}/><label>예선 원점수<input name="raw" type="number" min={0} max={300} required/></label><label><input type="checkbox" required/>프리게임이 아닌 유료 예선 1게임입니다.</label></Form><p>예선 핸디는 참가자 설정에서 가져와 기록별로 보존합니다. 0점은 유효하며 빈 칸은 미입력입니다.</p>
      {data.matches.map(m=><ScoreForm key={m.id+':'+data.revision} match={m} games={data.rules.games[m.stage as Stage]} entries={data.entries} run={run} enabled={data.state===m.stage+'_ACTIVE'&&!m.confirmed}/>)}{!data.matches.length&&<p>일정운영에서 본선 대진을 생성하면 입력표가 표시됩니다.</p>}</>}
    {tab===7 && <><h2>사이드게임</h2><p>단계별 참가 명단을 별도로 저장합니다. 기본은 각 게임, 볼사이드는 2G, 번외는 마지막 게임입니다. 기본 대회 진출 결과에 영향을 주지 않습니다.</p>
      <Form label="사이드 참가 설정 저장" onSubmit={f=>run('SIDE',{entryId:f.get('entryId'),stage:f.get('stage'),category:f.get('category'),enabled:f.has('enabled')},'사이드게임 참가 설정')}><MemberSelect entries={data.entries}/><select name="stage">{STAGES.map(s=><option key={s} value={s}>{labels[s]}</option>)}</select><select name="category"><option value="STANDARD">기본</option><option value="BALL">볼사이드 (2G)</option><option value="EXTRA">번외 (마지막 G)</option></select><label><input type="checkbox" name="enabled" defaultChecked/>참가</label></Form>
      {data.entries.filter(e=>e.sideEntries.length).map(e=><p key={e.id}>{e.name} · {e.sideEntries.map(s=>labels[s.stage]+' '+s.category).join(', ')}</p>)}
      <p>별도 시상·행운권 중복 시상 규칙은 주최측 확인이 필요합니다. 사이드 시상 자동 확정은 제공하지 않습니다.</p>
      {data.sideResults.map(group=><section key={group.key}><h3>{group.label}</h3><table><thead><tr><th>순위</th><th>이름</th><th>원점수</th><th>환산</th></tr></thead><tbody>{group.rows.map(r=><tr key={r.entryId}><td>{r.rank}</td><td>{name(r.entryId)}</td><td>{r.raw}</td><td>{r.total}</td></tr>)}</tbody></table></section>)}</>}
    {tab===8 && <><h2>최종 결과 / 정산</h2><p>정기전 및 발솔이벤트는 시상에서 제외</p><p>결승 핸디 0 · {data.state==='FINISHED'?'최종 결과 확정':'대회 종료 전 · 미확정'}</p>
      {data.matches.filter(m=>m.stage==='FINAL').map(m=><table key={m.id}><thead><tr><th>순위</th><th>이름</th><th>원점수</th><th>핸디</th><th>시상금</th></tr></thead><tbody>{[...m.seats].sort((a,b)=>(a.rank||99)-(b.rank||99)).map(s=><tr key={s.id}><td>{s.rank??'미확정'}</td><td>{name(s.entryId)}</td><td>{s.rawTotal??'미입력'}</td><td>{s.handicap}</td><td>{data.settlement?.winners?.find((w:{entryId:string})=>w.entryId===s.entryId)?.amount?.toLocaleString()??'정산 미확정'}</td></tr>)}</tbody></table>)}
      <Settlement rules={data.rules} run={run}/><p>시상 미리보기: {data.prizePreview ? data.prizePreview.amounts.map(won).join(' / ') : '기준 미확정 · 계산되지 않음'}</p><button disabled={data.state!=='FINISHED'||!!data.settlement} onClick={()=>run('SETTLE')}>정산 스냅샷 확정</button><button disabled={!data.settlement} onClick={()=>run('UNSETTLE')}>정산 잠금 해제</button><button disabled={data.state!=='FINISHED'} onClick={()=>run('PUBLISH',{published:!data.published},data.published?'결과 비공개 전환':'확정 결과 공개')}>{data.published?'결과 비공개':'결과 공개'}</button>
      {data.prizeWarning && <p role="alert">{data.prizeWarning}</p>}
      <h3>참가비 납부 원장</h3><p>취소된 유료 기록과 단계 잠금 해제 후 남은 원장은 관리자가 환불·취소를 확인해야 합니다.</p>{['QUALIFYING',...STAGES].map(s=><p key={s}>{s==='QUALIFYING'?'예선':labels[s]} · 납부 {won(fees.filter(f=>f.stage===s&&f.status==='PAID').reduce((a,b)=>a+b.amount,0))} / 미납 {won(fees.filter(f=>f.stage===s&&f.status==='UNPAID').reduce((a,b)=>a+b.amount,0))}</p>)}
      {fees.map(f=><details key={f.id}><summary>{f.name} · {f.stage} · {won(f.amount)} · {f.status}</summary><Form label="수동 납부 확인 / 조정" onSubmit={fd=>run('FEE',{feeId:f.id,status:fd.get('status'),amount:Number(fd.get('amount'))})}><select name="status" defaultValue={f.status}><option value="UNPAID">미납</option><option value="PAID">납부 확인</option><option value="CANCELLED">취소</option><option value="REFUNDED">환불 확인</option></select><input name="amount" type="number" min={0} max={100000000} defaultValue={f.amount} required/></Form></details>)}</>}
    {tab===9 && <><h2>행운권</h2><p>최종 대회 종료 후 추첨합니다. 기존 당첨자는 자동 제외되며 결과는 서버에서 저장합니다. 공개 여부는 최종 결과 공개 설정을 따릅니다.</p><Form label="추첨 및 결과 저장" onSubmit={f=>run('DRAW',{scope:f.get('scope'),count:Number(f.get('count')),excludeRankers:f.has('excludeRankers')},'행운권 추첨')}><label>대상<select name="scope"><option value="ALL">예선 유효 참가자 전체</option>{STAGES.map(s=><option key={s} value={s}>{labels[s]} 참가자</option>)}</select></label><label>추첨 인원<input type="number" name="count" min={1} max={100} defaultValue={1} required/></label><label><input type="checkbox" name="excludeRankers" defaultChecked/>입상자 1~4위 제외</label></Form><ol>{data.entries.filter(e=>e.luckyWin).map(e=><li key={e.id}>{e.name} · {date(e.luckyWin!.createdAt)}</li>)}</ol></>}
    </fieldset><footer>레인 패턴: 당 센터 평상정비 · 기타 명시되지 않은 사항은 주최측 판단</footer>
  </main>;
}
function Settings({rules,locked,run}:{rules:Rules;locked:boolean;run:Run}) {
  return <><h2>대회 설정</h2><p>게임 수 1과 같은 테이블 내 2R 이동은 임시값입니다. 실제 요강을 확인한 뒤 확인 항목을 선택하세요. 기록 반영 방식과 횟수 제한은 첫 예선 기록 후 잠깁니다.</p><fieldset disabled={locked}><Form label="설정 저장" onSubmit={f=>{
    const next:Rules={...rules,selection:f.get('selection') as Rules['selection'] || null,attemptLimit:f.get('attemptLimit')?Number(f.get('attemptLimit')):null,qualifyingConfirmed:f.has('qualifyingConfirmed'),handicapCap:f.get('handicapCap') as Rules['handicapCap'] || null,bankAccount:String(f.get('bankAccount')),mappingConfirmed:f.has('mappingConfirmed'),
      registrationStart:f.get('registrationStart')?new Date(String(f.get('registrationStart'))+'+09:00').toISOString():null,registrationEnd:f.get('registrationEnd')?new Date(String(f.get('registrationEnd'))+'+09:00').toISOString():null,
      lanes:[0,1,2,3].map(i=>String(f.get('lanes'+i)).split(',').map(Number)),round2Mapping:[0,1,2,3].map(i=>String(f.get('mapping'+i)).split(',').map(Number)),finalLanes:String(f.get('finalLanes')).split(',').map(Number),
      scoring:Object.fromEntries(STAGES.map(s=>[s,f.get(s+'Scoring')||null])) as Rules['scoring'],
      games:Object.fromEntries(STAGES.map(s=>[s,Number(f.get(s))])) as Rules['games'],gamesConfirmed:Object.fromEntries(STAGES.map(s=>[s,f.has(s+'Confirmed')])) as Rules['gamesConfirmed']};
    return run('SETTINGS',{rules:next});
  }}>
    <h3>예선 / 참가자격</h3><p>센터 회원만 허용 · 선수/프로 제외 · 예선 1게임 1,000원 · 프리게임 제외</p><label>참가 횟수 제한 (빈 칸 = 제한 없음)<input name="attemptLimit" type="number" min={1} max={10000} defaultValue={rules.attemptLimit??''}/></label><label>기록 반영<select name="selection" defaultValue={rules.selection??''}><option value="">미확정</option><option value="BEST">최고 환산 기록</option><option value="LATEST">최근 기록</option></select></label><label><input type="checkbox" name="qualifyingConfirmed" defaultChecked={rules.qualifyingConfirmed}/>참가 횟수와 반영 방식을 확인했습니다.</label>
    <h3>접수 기간 (한국시간)</h3>{(['registrationStart','registrationEnd'] as const).map(k=><label key={k}>{k==='registrationStart'?'시작':'종료'}<input type="datetime-local" name={k} defaultValue={rules[k]?new Date(+new Date(rules[k]!)+9*3600000).toISOString().slice(0,16):''}/></label>)}
    <h3>승자 판정 방식</h3>{STAGES.map(s=><label key={s}>{labels[s]} 점수 반영<select name={s+'Scoring'} defaultValue={rules.scoring[s]??''}><option value="">미확정</option><option value="SUM">전체 게임 합계</option><option value="BEST_GAME">최고 게임</option></select></label>)}
    <h3>본선 게임 수 / 핸디</h3>{STAGES.map(s=><label key={s}>{labels[s]} 게임 수<input name={s} type="number" min={1} max={12} defaultValue={rules.games[s]} required/><span><input type="checkbox" name={s+'Confirmed'} defaultChecked={rules.gamesConfirmed[s]}/>확인 완료</span></label>)}<label>1R·2R 환산 상한<select name="handicapCap" defaultValue={rules.handicapCap??''}><option value="">미확정</option><option value="LEAGUE_300">상주리그와 동일: 게임당 300점 상한</option><option value="UNCAPPED">운영자 확인: 상한 없이 합산</option></select></label><p>예선은 원점수+핸디 / 본선은 게임 합계 / 결승 핸디는 항상 0 / 동점은 관리자 순서 판정</p>
    <h3>레인 / 2R 승자 이동</h3>{[0,1,2,3].map(i=><div key={i}><label>테이블 {String.fromCharCode(65+i)} 레인 쌍<input name={'lanes'+i} defaultValue={rules.lanes[i].join(',')} required/></label><label>2R 테이블 {String.fromCharCode(65+i)}로 오는 1R 매치 번호 3개<input name={'mapping'+i} defaultValue={rules.round2Mapping[i].join(',')} required/></label></div>)}<label>결승 레인<input name="finalLanes" defaultValue={rules.finalLanes.join(',')} required/></label><label><input type="checkbox" name="mappingConfirmed" defaultChecked={rules.mappingConfirmed}/>2R 이동 매핑을 원본 요강과 대조했습니다.</label>
    <h3>참가비 계좌</h3><label>입금 안내<input name="bankAccount" maxLength={200} defaultValue={rules.bankAccount}/></label><p>본선 단계별 10,000원 · 결승 포함 · 자동 은행 조회 없음</p>
  </Form></fieldset>{locked&&<p>본선 확정 후 설정을 변경하려면 일정운영에서 예선 잠금을 해제하고 다시 확정하세요.</p>}<Settlement rules={rules} run={run}/></>;
}
function Settlement({rules,run}:{rules:Rules;run:Run}) {
  return <Form label="시상 기준 저장" onSubmit={f=>run('SETTLEMENT_SETTINGS',{prizeBasis:f.get('prizeBasis')||null,prizeBase:f.get('prizeBase')?Number(f.get('prizeBase')):null,prizeConfirmed:f.has('prizeConfirmed')})}><h3>시상 기준</h3><p>1위 20만원+50% / 2위 10만원+30% / 3위 5만원+10% / 4위 5만원. 잔여 10% 사용처는 별도 판단합니다.</p><select name="prizeBasis" defaultValue={rules.prizeBasis??''}><option value="">미확정</option><option value="PAID">예선 납부 확인액</option><option value="CHARGED">예선 발생액 (취소·환불 제외)</option><option value="MANUAL">관리자 지정 금액</option></select><label>관리자 지정 기준액<input name="prizeBase" type="number" min={0} max={100000000} defaultValue={rules.prizeBase??''}/></label><label><input type="checkbox" name="prizeConfirmed" defaultChecked={rules.prizeConfirmed}/>시상 기준 금액을 확인했습니다.</label></Form>;
}
function ScoreForm({match,games,entries,run,enabled}:{match:Match;games:number;entries:Entry[];run:Run;enabled:boolean}) {
  const [uploadError,setUploadError]=useState('');
  return <section className={styles.score}><h3>{labels[match.stage]} 경기 {match.slot} · {JSON.parse(match.lanes).join('·')}레인 · {match.confirmed?'확정':'미확정'}</h3><fieldset disabled={!enabled}><Form label="점수 저장 (미확정)" onSubmit={f=>run('SCORES',{matchId:match.id,scores:match.seats.flatMap(s=>Array.from({length:games},(_,i)=>({entryId:s.entryId,number:i+1,raw:f.get(s.id+':'+i)===''?null:Number(f.get(s.id+':'+i))})))},'경기 점수 저장')}><div className={styles.scroll}><table><thead><tr><th>선수 / 핸디</th>{Array.from({length:games},(_,i)=><th key={i}>{i+1}G</th>)}</tr></thead><tbody>{match.seats.map(s=><tr key={s.id}><td>{entries.find(e=>e.id===s.entryId)?.name} / {s.handicap}<small>{s.entryId}</small></td>{Array.from({length:games},(_,i)=><td key={i}><input aria-label={(entries.find(e=>e.id===s.entryId)?.name||'선수')+' '+(i+1)+'게임'} name={s.id+':'+i} type="number" min={0} max={300} defaultValue={s.games.find(g=>g.number===i+1)?.raw??''}/></td>)}</tr>)}</tbody></table></div></Form>
    <label>엑셀 입력 (첫 시트: entryId, number, raw)<input type="file" accept=".xlsx,.xls,.csv" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>2*1024*1024)throw new Error('2MB 이하 파일을 사용하세요.');const XLSX=await import('xlsx');const book=XLSX.read(await file.arrayBuffer(),{type:'array'});const rows=XLSX.utils.sheet_to_json<{entryId:string;number:number;raw:number|null}>(book.Sheets[book.SheetNames[0]],{defval:null});if(!rows.length||rows.length>144)throw new Error('1~144개 점수만 입력하세요.');await run('SCORES',{matchId:match.id,scores:rows},'엑셀 경기 점수 입력');setUploadError('');}catch(err){setUploadError(err instanceof Error?err.message:'엑셀 읽기 실패');}}}/></label><p role="status">{uploadError}</p>
    <Form label="점수 확인 후 경기 확정" onSubmit={f=>run('CONFIRM_MATCH',{matchId:match.id,tieOrder:ids(f.get('tieOrder')),...(f.has('exceptionConfirmed')?{overrideOrder:ids(f.get('overrideOrder')),exceptionConfirmed:true}:{})})}><label>동점자 ID 순서 (쉼표 구분)<input name="tieOrder"/></label><label><input type="checkbox" required/>저장된 점수와 동점 판정을 확인했습니다.</label><details><summary>주최측 특별 판정</summary><p>점수 순위와 다른 판정이 필요할 때만 사용하세요. 상단에 구체적인 사유를 남기고 경기 참가자 전체 ID를 순위대로 입력합니다.</p><input name="overrideOrder" aria-label="특별 판정 전체 순위"/><label><input type="checkbox" name="exceptionConfirmed"/>특별 판정을 적용합니다.</label></details></Form></fieldset></section>;
}
