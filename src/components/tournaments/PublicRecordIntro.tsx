import Link from 'next/link';

export default function PublicRecordIntro({title,kind,base}:{title:string;kind:'team'|'individual'|'round';base:string}) {
  const label=kind==='team'?'팀 누적 순위':kind==='individual'?'개인 누적 기록':'경기 결과';
  return <header className="px-4 py-5 space-y-3">
    <h1 className="text-2xl font-bold text-slate-900">{title} · {label}</h1>
    <p className="text-slate-600">{kind==='team'?'팀 순위와 주차별 경기 결과는 집계 범위가 다릅니다. 승점 배점과 동점 기준은 해당 대회 요강을 확인하세요.':kind==='individual'?'총점·평균을 비교할 때 게임 수와 핸디 포함 여부를 함께 확인하세요. 시상 인정 게임 수는 해당 대회 기준을 따릅니다.':'선택한 회차의 게임별 점수와 핸디·총점을 확인하세요. 입력·정정에 따라 결과가 바뀔 수 있으므로 이상이 있으면 대회 운영자에게 확인해주세요.'}</p>
    <nav className="flex flex-wrap gap-4 text-primary underline" aria-label="경기 기록 안내"><Link href={base}>대회 안내로</Link><Link href="/guide/league-results-reading-guide">결과표 읽는 법</Link><Link href="/inquiry">오류·정정 문의 안내</Link></nav>
  </header>;
}
