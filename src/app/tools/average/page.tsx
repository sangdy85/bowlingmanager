import type { Metadata } from 'next';
import Link from 'next/link';
import AverageCalculator from '@/components/public/AverageCalculator';
import AppGrowthCta from '@/components/public/AppGrowthCta';
import PublicNav from '@/components/public/PublicNav';
import styles from '@/components/public/Public.module.css';
import { PUBLIC_ORIGIN } from '@/lib/public-web';

export const metadata: Metadata = { title: '볼링 평균 계산기 | 볼링매니저', description: '가입 없이 게임 수, 총점, 평균, 최고·최저 점수를 계산하세요. 입력한 점수는 브라우저에서만 계산합니다.', alternates: { canonical: `${PUBLIC_ORIGIN}/tools/average` } };
export default function AveragePage() {
  return <div className={styles.surface}><PublicNav /><div className={styles.article}>
    <p className={styles.eyebrow}>FREE TOOL · 가입 없이 사용</p><h1>볼링 평균 계산기</h1>
    <p>오늘의 점수를 모아 평균을 확인하세요. 핸디캡을 더하기 전, 완료한 게임의 점수를 입력하면 서로 같은 기준으로 비교하기 쉽습니다.</p>
    <AverageCalculator />
    <h2>어떻게 계산하나요?</h2><p><strong>평균 = 총점 ÷ 게임 수</strong>. 계산 중에는 반올림하지 않고, 평균을 표시할 때만 소수점 첫째 자리까지 반올림합니다.</p>
    <div className={styles.notice}><strong>가상 예시</strong><p>120점, 150점, 180점의 총점은 450점, 게임 수는 3게임입니다. 평균은 450 ÷ 3 = 150.0점, 최고는 180점, 최저는 120점입니다.</p></div>
    <h2>0점과 빈 입력은 다릅니다</h2><p>0점은 실제 게임 한 번으로 집계합니다. 0점과 200점은 총점 200점, 2게임, 평균 100.0점입니다. 빈칸이나 연속 구분자는 게임으로 세지 않습니다. 소수 점수, 음수, 300점을 넘는 점수는 허용하지 않습니다.</p>
    <h2>입력과 결과 이용 안내</h2><p>점수는 이 브라우저에서만 계산하며 저장하거나 서버·분석도구로 전송하지 않습니다. 페이지를 새로 열면 초기화됩니다. 계산에는 JavaScript가 필요하며, 꺼져 있어도 위 계산식과 예시는 읽을 수 있습니다.</p>
    <p>대회 공인 에버리지의 인정 기간, 최소 게임 수, 절사 방식은 각 대회 요강을 확인하세요. 이 계산기는 핸디캡이나 대회 순위를 산정하지 않습니다.</p>
    <AppGrowthCta source="average" variant="compact" />
    <Link href="/guide/average-and-score-distribution">같은 평균, 다른 점수 분포 이해하기 →</Link>
  </div></div>;
}
