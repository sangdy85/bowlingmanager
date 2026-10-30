import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { PUBLIC_ORIGIN } from '@/lib/public-web';

export async function publicRecordMetadata(centerId: string, tournamentId: string, kind: 'overview' | 'team' | 'individual' | 'round', roundId?: string): Promise<Metadata> {
  const tournament = await prisma.tournament.findUnique({where:{id:tournamentId},select:{name:true,centerId:true,type:true}});
  if(!tournament || tournament.centerId!==centerId)return {title:'대회를 찾을 수 없습니다',robots:{index:false,follow:false}};
  if((kind==='team'||kind==='individual')&&tournament.type!=='LEAGUE')return {robots:{index:false,follow:false}};
  const base=`/centers/${centerId}/tournaments/${tournamentId}`;
  let label=kind==='team'?'팀 누적 순위':kind==='individual'?'개인 누적 기록':'대회 안내·경기 기록';
  let suffix=kind==='team'?'/leaderboard':kind==='individual'?'/individual-leaderboard':'';
  if(kind==='round'){
    const round=roundId?await prisma.leagueRound.findUnique({where:{id:roundId},select:{tournamentId:true,roundNumber:true}}):null;
    if(!round||round.tournamentId!==tournamentId)return {title:'경기 결과를 찾을 수 없습니다',robots:{index:false,follow:false}};
    label=`${round.roundNumber}${tournament.type==='LEAGUE'?'주차':'회차'} 경기 결과`;
    suffix=`/rounds/${roundId}/results`;
  }
  return {title:`${tournament.name} · ${label} | 볼링매니저`,description:`${tournament.name}의 ${label}를 확인하세요. 게임별 점수와 핸디 적용 기준은 해당 대회 요강과 운영자 안내를 함께 확인해주세요.`,alternates:{canonical:PUBLIC_ORIGIN+base+suffix}};
}
