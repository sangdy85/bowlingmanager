import prisma from '@/lib/prisma';
import { todayInKorea } from '@/lib/competition-notices';

export const EQUIPMENT_SOURCES = [
    { brand: 'STORM', title: 'STORM · 볼링공 라인업', description: '제조사가 공개한 볼링공 목록에서 모델별 커버·코어와 사양을 확인하세요.', url: 'https://www.stormbowling.com/products/equipment/bowling-balls/' },
    { brand: 'MOTIV', title: 'MOTIV · Ball Guide', description: '제조사의 비교표에서 볼링공 라인업과 모델 간 위치를 살펴보세요.', url: 'https://www.motivbowling.com/ball-guide/ball-guide.html' },
    { brand: 'MOTIV', title: 'Frenzy · Blue / Teal', description: '공식 라인업에서 확인한 모델입니다. 상세 사양과 출시 정보는 제조사 원문에서 확인하세요.', url: 'https://www.motivbowling.com/products/balls/entry-level/frenzy-blue-teal.html' },
] as const;
export const EQUIPMENT_CHECKED_AT = '2026-10-13';
export function tournamentLabel(type: string) {
    return ({ LEAGUE: '상주리그', CHAMP: '챔프전', EVENT: '이벤트전', CUSTOM: '특별 대회' } as Record<string,string>)[type] ?? '대회';
}
export function tournamentStatus(status: string) {
    return ({ PLANNING:'예정', ONGOING:'진행 중', FINISHED:'종료', COMPLETED:'종료' } as Record<string,string>)[status] ?? '요강 확인';
}
export function portalDate(date: Date) {
    return new Intl.DateTimeFormat('ko-KR', { month:'numeric', day:'numeric', timeZone:'Asia/Seoul' }).format(date);
}
export async function latestTournaments() {
    return prisma.tournament.findMany({ where:{status:{in:['PLANNING','ONGOING']}}, orderBy:[{startDate:'desc'},{id:'asc'}], take:6,
        select:{id:true,name:true,type:true,status:true,startDate:true,endDate:true,centerId:true,center:{select:{name:true,address:true}}} });
}
export async function latestCompetitionNotices() {
    const today = new Date(todayInKorea()+'T00:00:00Z');
    return prisma.competitionNotice.findMany({where:{published:true,endDate:{gte:today}}, orderBy:[{startDate:'asc'},{id:'asc'}],take:6});
}
export async function latestCommunityPosts() {
    return prisma.communityPost.findMany({ where:{status:'PUBLISHED'}, take:5, orderBy:[{createdAt:'desc'},{id:'desc'}],
        select:{id:true,category:true,title:true,createdAt:true,author:{select:{name:true}},_count:{select:{comments:{where:{status:'PUBLISHED'}}}}} });
}
export async function latestEquipmentPosts() {
    return prisma.communityPost.findMany({where:{category:'EQUIPMENT',status:'PUBLISHED'},take:3,orderBy:[{createdAt:'desc'},{id:'desc'}],select:{id:true,title:true,equipmentType:true,author:{select:{name:true}}}});
}
