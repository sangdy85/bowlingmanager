import Link from "next/link";
import RadarChart from "@/components/RadarChart";
import type { calculatePersonalProfile } from "@/lib/personal-profile";
import type { ReactNode } from "react";
import type { summarizeIntegratedRecords } from "@/lib/personal-statistics";
import { DashboardHeader, DashboardQuickActions, DashboardSection, EmptyState, StatCard, StatusBadge, dashboardStyles as styles } from "./DashboardUI";

type Summary = ReturnType<typeof summarizeIntegratedRecords>;
const dateLabel = (date: Date) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" }).format(date);

export default function PersonalDashboardOverview({ name, teamNames, summary, canAddScore, yearControl, radar }: { name: string; teamNames: string[]; summary: Summary; canAddScore: boolean; yearControl?: ReactNode; radar: ReturnType<typeof calculatePersonalProfile>["radar"] }) {
    const radarDatasets = radar.series.map(series => ({ label: series.label, color: series.key === "OFFICIAL" ? "#b45309" : "#2563eb", points: series.values }));
    const hasGames = summary.gameCount > 0;
    const recent = summary.recentScores;
    const points = [...recent].reverse();
    const minimum = Math.min(0, ...points.map(point => point.score));
    const maximum = Math.max(50, Math.ceil(Math.max(0, ...points.map(point => point.score)) / 50) * 50);
    const coordinates = points.map((point, index) => ({
        ...point,
        x: points.length === 1 ? 320 : 52 + index * 548 / (points.length - 1),
        y: 180 - (point.score - minimum) / (maximum - minimum) * 152,
    }));
    return <>
        <DashboardHeader eyebrow="MY PERFORMANCE" title={`${name}님의 기록실`} description={<>{summary.year}년의 기록을 한눈에 살펴보세요.<br />{teamNames.join(" · ")}</>} actions={<DashboardQuickActions canAddScore={canAddScore} />} />
        {yearControl}
        <dl className={styles.statGrid} aria-label={`${summary.year}년 통합 기록 요약`}>
            <StatCard label="평균 점수" value={hasGames ? summary.average.toFixed(1) : "—"} unit={hasGames ? "점" : undefined} note="선택 연도 · 통합 기록" featured />
            <StatCard label="최고 점수" value={hasGames ? summary.highScore : "—"} unit={hasGames ? "점" : undefined} note="핸디캡 포함 기록 기준" />
            <StatCard label="총 게임 수" value={summary.gameCount.toLocaleString("ko-KR")} unit="게임" note={`${summary.year}년 누적 게임`} />
            <StatCard label="최근 10게임 평균" value={recent.length ? summary.recentAverage.toFixed(1) : "—"} unit={recent.length ? "점" : undefined} note={recent.length ? `선택 연도 최근 ${recent.length}게임 기준` : "첫 기록을 기다리고 있어요"} />
        </dl>
        <p className={styles.scopeNote}>통합 기록은 개인·리그·대회 기록을 합산하며 벙개는 제외합니다. 점수와 핸디캡은 기존 통계 기준을 따릅니다.</p>
        {!hasGames ? <EmptyState title="아직 이 연도의 기록이 없어요" description={canAddScore ? "첫 점수를 등록하거나 다른 연도를 선택해 나의 기록을 확인해 보세요." : "다른 연도를 선택하거나 팀 관리자에게 점수 등록을 요청해 주세요."} action={canAddScore ? <Link className={styles.primaryButton} href="/score/add">첫 점수 등록</Link> : <Link className={styles.secondaryButton} href="/team">소속 팀 보기</Link>} /> : <>
            <div className={styles.insightsGrid}>
            <DashboardSection id="personal-radar" title="나의 볼링 프로필" description="다섯 가지 지표로 살펴보는 나의 기록" action={<StatusBadge tone="primary">오각형 분석</StatusBadge>}>
                {radarDatasets.length ? <figure className={styles.radarFigure}>
                    <RadarChart datasets={radarDatasets} labels={radar.axes.map(axis => axis.label)} size={360} appearance="light" />
                    <figcaption>
                        <ul className={styles.radarLegend} aria-label="그래프 범례">{radarDatasets.map((dataset, index) => <li key={dataset.label}><span aria-hidden="true" style={{ borderColor: dataset.color, borderTopStyle: index > 0 ? "dashed" : "solid" }} />{dataset.label}</li>)}</ul>
                        <p>각 지표는 0–10 척도입니다. 정기전·볼링장 대회별 3회 이상 기록된 항목만 표시합니다.</p>
                    </figcaption>
                </figure> : <div className={styles.radarEmpty}><span aria-hidden="true">⬟</span><h3>기록이 쌓이면 프로필이 보여요</h3><p>선택 연도에 정기전 또는 볼링장 대회 기록이 3회 이상 쌓이면 오각형 그래프를 확인할 수 있습니다.</p></div>}
            </DashboardSection>
            <DashboardSection id="recent-trend" title="최근 점수 추이" description={`선택 연도의 최근 ${recent.length}게임 · 오래된 기록부터 표시`} action={<StatusBadge tone="primary">최근 {recent.length}게임</StatusBadge>}>
                <figure className={styles.chart}>
                    <svg viewBox="0 0 640 220" role="img" aria-labelledby="score-trend-title score-trend-description">
                        <title id="score-trend-title">{`최근 ${recent.length}게임 점수 추이`}</title>
                        <desc id="score-trend-description">{coordinates.map(point => `${dateLabel(point.gameDate)} ${point.score}점`).join(", ")}. 아래 최근 게임 기록에서도 값을 확인할 수 있습니다.</desc>
                        {[0, .5, 1].map(ratio => <g key={ratio}><line x1="52" x2="600" y1={180 - ratio * 152} y2={180 - ratio * 152} className={styles.chartGrid} /><text x="40" y={185 - ratio * 152} textAnchor="end" className={styles.chartLabel}>{Math.round(minimum + (maximum - minimum) * ratio)}</text></g>)}
                        <polyline points={coordinates.map(point => `${point.x},${point.y}`).join(" ")} className={styles.chartLine} />
                        {coordinates.map(point => <circle key={point.id} cx={point.x} cy={point.y} r="4.5" className={styles.chartPoint}><title>{`${dateLabel(point.gameDate)} · ${point.gameType || "개인 기록"} · ${point.score}점`}</title></circle>)}
                        <text x="52" y="212" className={styles.chartLabel}>{dateLabel(coordinates[0].gameDate)}</text>
                        {coordinates.length > 1 && <text x="600" y="212" textAnchor="end" className={styles.chartLabel}>{dateLabel(coordinates[coordinates.length - 1].gameDate)}</text>}
                    </svg>
                    <figcaption>경기별 점수 · 핸디캡이 포함된 기록은 300점을 넘을 수 있습니다.</figcaption>
                </figure>
            </DashboardSection>
            </div>
            <DashboardSection id="recent-games" title="최근 게임 기록" description="날짜, 경기 유형과 점수를 확인하세요." action={<Link href="#personal-details" className={styles.secondaryButton}>상세 기록</Link>}>
                <ol className={styles.recordList}>{recent.map(record => <li className={styles.record} key={record.id}>
                    <span className={styles.recordIcon} aria-hidden="true">◷</span>
                    <div><div className={styles.recordTitle}>{record.gameType || "개인 기록"}<StatusBadge tone={record.source === "PERSONAL" ? "neutral" : "primary"}>{record.source === "PERSONAL" ? "개인" : record.source === "LEAGUE" ? "리그" : "대회"}</StatusBadge></div><div className={styles.recordMeta}><time dateTime={record.gameDate.toISOString()}>{dateLabel(record.gameDate)}</time>{record.team?.name ? ` · ${record.team.name}` : ""}</div></div>
                    <div className={styles.recordScore}>{record.score} <span>점</span></div>
                </li>)}</ol>
            </DashboardSection>
        </>}
    </>;
}
