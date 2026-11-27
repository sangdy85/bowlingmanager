'use client';
import { useState } from 'react';
import { calculateAverage } from '@/lib/average-calculator';
import styles from './Public.module.css';

export default function AverageCalculator() {
  const [input, setInput] = useState('');
  const [calculation, setCalculation] = useState<ReturnType<typeof calculateAverage>>({});
  const result = calculation.result;
  return <section aria-label="평균 계산 입력">
    <form onSubmit={event => { event.preventDefault(); setCalculation(calculateAverage(input)); }}>
      <label htmlFor="game-scores">게임 점수</label>
      <p id="score-help">0~300 사이의 정수를 쉼표, 공백 또는 줄바꿈으로 구분하세요. 예: 120, 150, 180</p>
      <textarea id="game-scores" value={input} onChange={event => { setInput(event.target.value); setCalculation({}); }} aria-describedby="score-help score-error" aria-invalid={!!calculation.error} placeholder="120, 150, 180" maxLength={10000} />
      <div className={styles.actions}><button type="submit">계산하기</button><button type="button" onClick={() => { setInput('120, 150, 180'); setCalculation(calculateAverage('120, 150, 180')); }}>가상 예시 넣기</button><button type="button" onClick={() => { setInput(''); setCalculation({}); }}>초기화</button></div>
    </form>
    <div aria-live="polite" aria-atomic="true">
      <p id="score-error" className={styles.error}>{calculation.error}</p>
      {result && <dl className={styles.results}>
        <div><dt>게임 수</dt><dd>{result.count}</dd></div><div><dt>총점</dt><dd>{result.total}</dd></div>
        <div><dt>평균</dt><dd>{result.average.toFixed(1)}</dd></div><div><dt>최고</dt><dd>{result.high}</dd></div><div><dt>최저</dt><dd>{result.low}</dd></div>
      </dl>}
    </div>
  </section>;
}
