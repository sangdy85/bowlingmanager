import resultStyles from './ResultVisibility.module.css';

export default function LuckyDrawWinners({ winners }: { winners: any[] }) {
    return (
        <ol className={resultStyles.winnerGrid} aria-label="행운권 추첨 당첨자 명단">
            {winners.map((winner: any, index: number) => {
                const name = winner.registration?.guestName ?? winner.registration?.user?.name ?? '이름 미등록';
                const team = (winner.registration?.guestTeamName ?? winner.registration?.team?.name) || '개인회원';
                return (
                    <li key={winner.registrationId ?? `${name}-${index}`} className={resultStyles.winnerCard}>
                        <span className={resultStyles.winnerNumber} aria-hidden="true">{index + 1}</span>
                        <span className={resultStyles.winnerInfo}>
                            <span className={resultStyles.winnerLabel}>{index + 1}차 당첨</span>
                            <strong className={resultStyles.winnerName}>{name}</strong>
                            <span className={resultStyles.winnerTeam}>{team}</span>
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}
