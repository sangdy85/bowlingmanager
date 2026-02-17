import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import LaneLottery from '@/components/tournaments/LaneLottery';

export default async function LaneLotteryPage({ params }: { params: { id: string, tournamentId: string, roundId: string } }) {
    const session = await auth();
    if (!session?.user) return redirect('/login');

    // Fetch Round with participants and their user info
    // We need to find the specific participation record for the current user
    const round = await prisma.leagueRound.findUnique({
        where: { id: params.roundId },
        include: {
            participants: {
                include: {
                    registration: true
                }
            }
        }
    });

    if (!round) return notFound();

    // Find if current user is a participant
    const participation = round.participants.find(p => p.registration.userId === session.user.id);

    if (!participation) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                    <h1 className="text-xl font-bold text-red-600 mb-2">접근 권한 없음</h1>
                    <p className="text-gray-600 mb-6">이 라운드의 참가자만 레인을 추첨할 수 있습니다.</p>
                    <a href={`/centers/${params.id}/tournaments/${params.tournamentId}/rounds/${params.roundId}`} className="btn btn-outline w-full">돌아가기</a>
                </div>
            </div>
        );
    }

    // Lane Config
    const laneConfig = round.laneConfig ? JSON.parse(round.laneConfig) : {};

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex flex-col items-center justify-center p-4">
            <LaneLottery
                roundId={round.id}
                registrationId={participation.registrationId} // Pass registrationId needed for action
                laneConfig={laneConfig}
                startLane={round.startLane || 1}
                endLane={round.endLane || 10}
                currentLane={participation.lane}
                roundDate={round.date?.toISOString() || ''}
            />
        </div>
    );
}
