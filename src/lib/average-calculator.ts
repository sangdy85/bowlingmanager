export type AverageResult = { count: number; total: number; average: number; high: number; low: number };
export function calculateAverage(input: string): { result?: AverageResult; error?: string } {
  if (!input.trim()) return { error: '점수를 하나 이상 입력해 주세요. 0점도 입력할 수 있습니다.' };
  const tokens = input.trim().split(/[\s,]+/).filter(Boolean);
  if (!tokens.length) return { error: '점수를 하나 이상 입력해 주세요.' };
  if (tokens.length > 1000) return { error: '한 번에 1,000게임까지 계산할 수 있습니다.' };
  for (const token of tokens) {
    if (!/^\d+$/.test(token) || Number(token) > 300) return { error: `“${token}”은 유효하지 않습니다. 0~300 사이의 정수 점수를 입력해 주세요.` };
  }
  const scores = tokens.map(Number);
  const total = scores.reduce((sum, score) => sum + score, 0);
  return { result: { count: scores.length, total, average: total / scores.length, high: Math.max(...scores), low: Math.min(...scores) } };
}
