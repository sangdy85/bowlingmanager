import Link from 'next/link';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { getKingPerfectAdmin } from '@/lib/king-perfect/service';
import KingPerfectManager from './KingPerfectManager';
import { notFound } from 'next/navigation';

export default async function KingPerfectPage({ tournamentId, centerId, editionId }: { tournamentId: string; centerId: string; editionId?: string }) {
  const session = await auth();
  const tournament = await prisma.tournament.findFirst({ where: { id: tournamentId, centerId }, include: { center: { include: { managers: { select: { id: true } } } }, kingPerfectEditions: { orderBy: { month: 'desc' } } } });
  if (!tournament) notFound();
  const isAdmin = !!session?.user?.id && (tournament.center.ownerId === session.user.id || tournament.center.managers.some(m => m.id === session.user!.id));
  const editions = tournament.kingPerfectEditions.filter(e => isAdmin || e.published);
  const edition = editionId ? editions.find(e => e.id === editionId) : editions[0];
  if (!edition) return <main className="card p-6"><h1>♛ KING PERFECT</h1><p>아직 공개된 결과가 없습니다.</p><Link href={`/centers/${centerId}`}>센터로 돌아가기</Link></main>;
  const navigation = <nav aria-label="월별 회차" className="flex flex-wrap gap-3 p-4">{editions.map(e => <Link key={e.id} href={`?edition=${e.id}`} aria-current={e.id === edition.id ? 'page' : undefined}>{e.month} {e.id === edition.id ? '●' : ''}</Link>)}</nav>;
  if (isAdmin) {
    const data = await getKingPerfectAdmin(session!.user!.id!, edition.id);
    return <>{navigation}<KingPerfectManager key={edition.id} data={data} /></>;
  }
  // Public projection contains no fee ledger, bank account, audit or eligibility records.
  const final = await prisma.kingPerfectMatch.findFirst({ where: { editionId: edition.id, stage: 'FINAL', confirmed: true }, select: { seats: { orderBy: { rank: 'asc' }, select: { rank: true, rawTotal: true, entry: { select: { name: true } } } } } });
  const lucky = await prisma.kingPerfectLuckyWin.findMany({ where: { entry: { editionId: edition.id } }, select: { entry: { select: { name: true } } } });
  return <main className="card p-6">{navigation}<h1>♛ {tournament.name} · {edition.month}</h1><p>최종 확정 결과 · 결승 핸디 0</p>
    <table><thead><tr><th>순위</th><th>이름</th><th>원점수</th></tr></thead><tbody>{final?.seats.map((s,i) => <tr key={i}><td>{s.rank}</td><td>{s.entry.name}</td><td>{s.rawTotal}</td></tr>)}</tbody></table>
    <h2>행운권 당첨자</h2><p>{lucky.map(x => x.entry.name).join(', ') || '추첨 전'}</p>
  </main>;
}
