/** Fictional game effects, measured on the common race simulation clock. */
export const RACE_ITEMS = [
    { key: 'gutter', icon: '🕳️', name: '거터 트랩', color: '#969eba', description: '밟는 순간 1.5초 동안 움직일 수 없습니다.' },
    { key: 'turkey', icon: '❌', name: '터키', color: '#ff9b4b', description: 'X 세 개를 선두 1·2·3위에게 보내 1초 동안 멈춥니다. 자신은 공격하지 않습니다.' },
    { key: 'dry', icon: '🏜️', name: '드라이존', color: '#dfb05c', description: '앞쪽에 3초간 마찰 구간을 만듭니다. 닿은 다른 공은 3초 동안 속도가 1/1.8로 감소합니다.' },
    { key: 'strike', icon: '🎳', name: '스트라이크 부스트', color: '#45e5bc', description: '2초 동안 1.5배로 가속합니다.' },
    { key: 'split', icon: '🚧', name: '스플릿 장벽', color: '#ffaccc', description: '앞 순위 두 공에게 장벽을 보내 2초 동안 속도를 1/1.8로 낮춥니다.' },
    { key: 'pinShot', icon: '🎯', name: '핀샷', color: '#ff8288', description: '바로 앞 공에 핀을 발사해 짧게 밀어내고 1초 동안 움직이지 못하게 합니다.' },
    { key: 'kingPin', icon: '👑', name: '킹핀 체이서', color: '#ffda63', description: '선두를 추적하는 핀을 발사해 1.5초 동안 움직이지 못하게 합니다.' },
    { key: 'perfect', icon: '✨', name: '퍼펙트 클린', color: '#ede4ff', description: '방해 효과를 해제하고 1.5초 동안 1.5배로 가속합니다. 처음 1초는 공격을 막습니다.' },
    { key: 'spare', icon: '🛡️', name: '스페어 가드', color: '#72c8ff', description: '2초 안에 받는 공격 한 번을 막습니다.' },
    { key: 'bowlingPin', icon: '🎳', name: '볼링핀', color: '#faf2df', description: '부딪치는 순간 속도가 0이 되고, 그 자리에서 부드럽게 다시 가속합니다.' },
    { key: 'spin', icon: '🌪️', name: '고속회전', color: '#ff725c', description: '2초 동안 2배로 가속하며 부딪히는 다른 공을 밀어냅니다.' },
] as const;
export type RaceItemKey = typeof RACE_ITEMS[number]['key'];
export type RaceAttack = 'dry' | 'pinShot' | 'kingPin' | 'split' | 'turkey' | 'spin';
export const RaceEffect = { STRIKE: 1, SPARE: 2, TURKEY: 4, DRY: 32, PIN: 64, SPLIT: 128, GUTTER: 256, SPIN: 512, PERFECT: 1024, RECOVERY: 2048, PROTECTED: 4096 } as const;
const effectInfo = [
    [RaceEffect.STRIKE, '🎳', '스트라이크'], [RaceEffect.SPARE, '🛡️', '가드'], [RaceEffect.TURKEY, '❌', '터키 정지'],
    [RaceEffect.DRY, '🏜️', '마찰'], [RaceEffect.PIN, '🎯', '핀 충돌'], [RaceEffect.SPLIT, '🚧', '스플릿'],
    [RaceEffect.GUTTER, '🕳️', '거터 정지'], [RaceEffect.SPIN, '🌪️', '고속회전'], [RaceEffect.PERFECT, '✨', '퍼펙트'], [RaceEffect.RECOVERY, '🎳', '재가속'],
] as const;
export function raceEffectLabels(mask: number) { return effectInfo.filter(([bit]) => mask & bit).map(([, icon, name]) => icon + ' ' + name); }
export function raceEffectIcons(mask: number) { return effectInfo.filter(([bit]) => mask & bit).map(([, icon]) => icon); }
export type RaceItemState = {
    speed: number; strike: number; spare: number; turkey: number; dry: number; pin: number; split: number; gutter: number;
    spin: number; perfect: number; perfectAt: number; recovery: number; knockbackAt: number; knockbackUntil: number; knockbackStrength: number; collisionUntil: number;
};
export function createRaceItemState(): RaceItemState {
    return { speed: 24, strike: 0, spare: 0, turkey: 0, dry: 0, pin: 0, split: 0, gutter: 0, spin: 0, perfect: 0, perfectAt: 0, recovery: 0, knockbackAt: 0, knockbackUntil: 0, knockbackStrength: 0, collisionUntil: 0 };
}
export function activateRaceItem(p: RaceItemState, kind: RaceItemKey, now: number) {
    if (kind === 'strike') p.strike = now + 2000;
    if (kind === 'spare') p.spare = now + 2000;
    if (kind === 'spin') p.spin = now + 2000;
    if (kind === 'gutter') { p.gutter = now + 1500; p.speed = 0; p.knockbackUntil = 0; }
    if (kind === 'bowlingPin') { p.speed = 0; p.recovery = now + 1000; }
    if (kind === 'perfect') {
        p.dry = p.pin = p.split = p.gutter = p.turkey = p.knockbackUntil = 0;
        p.speed = Math.max(0, p.speed); p.perfectAt = now; p.perfect = now + 1500;
    }
}
export function raceAttackTargets(kind: RaceAttack, ranked: number[], actor: number) {
    const place = ranked.indexOf(actor);
    if (kind === 'turkey') return ranked.slice(0, 3).filter(i => i !== actor);
    if (kind === 'kingPin') return ranked.length && ranked[0] !== actor ? [ranked[0]] : [];
    return place > 0 ? ranked.slice(Math.max(0, place - (kind === 'split' ? 2 : 1)), place) : [];
}
export function applyRaceAttack(p: RaceItemState, kind: RaceAttack, now: number): 'hit' | 'spare' | 'perfect' | 'cooldown' {
    if (kind === 'spin' && p.collisionUntil > now) return 'cooldown';
    if (kind === 'spin') p.collisionUntil = now + 650;
    if (p.perfect > now && now - p.perfectAt < 1000) return 'perfect';
    if (p.spare > now) { p.spare = 0; return 'spare'; }
    if (kind === 'dry') p.dry = Math.max(p.dry, now + 3000);
    else if (kind === 'split') p.split = Math.max(p.split, now + 2000);
    else if (kind === 'turkey') { p.turkey = Math.max(p.turkey, now + 1000); p.speed = 0; }
    else {
        p.pin = Math.max(p.pin, now + (kind === 'kingPin' ? 1500 : kind === 'spin' ? 400 : 1000)); p.speed = 0;
        if (kind !== 'kingPin') { p.knockbackAt = now; p.knockbackUntil = now + (kind === 'spin' ? 400 : 200); p.knockbackStrength = kind === 'spin' ? 18 : 8; }
    }
    return 'hit';
}
/** Strongest boost/slow wins; stun always wins over acceleration. No position teleports. */
export function advanceRaceItemSpeed(p: RaceItemState, baseSpeed: number, now: number, stepMs: number) {
    if (p.pin > now || p.gutter > now || p.turkey > now) {
        p.speed = p.knockbackUntil > now ? -p.knockbackStrength * (1 - (now - p.knockbackAt) / (p.knockbackUntil - p.knockbackAt)) : 0;
    } else {
        const boost = p.spin > now ? 2 : p.strike > now || p.perfect > now ? 1.5 : 1;
        const slow = p.dry > now || p.split > now ? 1 / 1.8 : 1;
        p.speed += (baseSpeed * boost * slow - p.speed) * (1 - Math.exp(-stepMs / (p.recovery > now ? 450 : 220)));
    }
    return p.speed;
}
export function raceItemEffects(p: RaceItemState, now: number) {
    return (p.strike > now ? RaceEffect.STRIKE : 0) | (p.spare > now ? RaceEffect.SPARE : 0) | (p.turkey > now ? RaceEffect.TURKEY : 0) |
        (p.dry > now ? RaceEffect.DRY : 0) | (p.pin > now ? RaceEffect.PIN : 0) | (p.split > now ? RaceEffect.SPLIT : 0) |
        (p.gutter > now ? RaceEffect.GUTTER : 0) | (p.spin > now ? RaceEffect.SPIN : 0) | (p.perfect > now ? RaceEffect.PERFECT : 0) |
        (p.perfect > now && now - p.perfectAt < 1000 ? RaceEffect.PROTECTED : 0) | (p.recovery > now ? RaceEffect.RECOVERY : 0);
}
