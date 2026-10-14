export const COMMUNITY_CATEGORIES = [
    { id: 'FREE', label: '자유게시판', description: '오늘의 볼링 이야기와 경험' },
    { id: 'QUESTION', label: '질문과 답변', description: '궁금한 것을 함께 풀어보세요' },
    { id: 'TOURNAMENT', label: '대회 소식', description: '대회 안내와 참가 이야기' },
    { id: 'EQUIPMENT', label: '용품 이야기', description: '볼·신발·장비 사용 경험' },
] as const;

export function categoryLabel(category: string) {
    return COMMUNITY_CATEGORIES.find(item => item.id === category)?.label ?? '자유게시판';
}

export function validCategory(category: string) {
    return COMMUNITY_CATEGORIES.some(item => item.id === category);
}

export function validatePost(data: { category: string; title: string; content: string }) {
    if (!data || typeof data.category !== 'string' || typeof data.title !== 'string' || typeof data.content !== 'string') throw new Error('입력 내용을 확인해주세요.');
    if (!validCategory(data.category)) throw new Error('게시판을 선택해주세요.');
    const title = data.title.trim();
    const content = data.content.trim();
    if (title.length < 2 || title.length > 100) throw new Error('제목은 2~100자로 입력해주세요.');
    if (content.length < 10 || content.length > 10000) throw new Error('본문은 10~10,000자로 입력해주세요.');
    return { category: data.category, title, content };
}

export function communityDate(value: Date | string) {
    return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
