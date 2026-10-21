export type LeaguePlayerIdentity = {
    id?: string;
    teamId: string;
    teamSquad?: string | null;
    userId?: string | null;
    playerName?: string | null;
    identityMode?: 'GUEST';
    User?: { name?: string | null } | null;
};

export type LeagueMemberOption = {
    userId: string;
    name: string;
    teamId: string;
    squad: string | null;
    allSquads?: boolean;
};

const normalizedName = (value?: string | null) => value?.trim().normalize('NFC') || '';

export function changeLeaguePlayerName<T extends LeaguePlayerIdentity>(row: T, name: string): T {
    return {
        ...row,
        playerName: name,
        // Re-entering the same name must not silently unlink a member.
        userId: normalizedName(name) === normalizedName(row.playerName) ? row.userId : null,
        ...(normalizedName(name) !== normalizedName(row.playerName) ? { identityMode: undefined } : {}),
    };
}

export function getLeagueMemberOptions(registrations: Array<{
    userId: string | null;
    teamId?: string | null;
    squad?: string | null;
    user?: { name?: string | null } | null;
}>): LeagueMemberOption[] {
    return registrations.flatMap(reg => reg.userId && reg.teamId && normalizedName(reg.user?.name)
        ? [{ userId: reg.userId, name: reg.user!.name!.trim(), teamId: reg.teamId, squad: reg.squad || null }]
        : []);
}

export function preserveLeagueScoreIdentities<T extends LeaguePlayerIdentity>(
    scores: T[], existing: LeaguePlayerIdentity[], members: LeagueMemberOption[],
): T[] {
    const resolved = scores.map(score => {
        const sameTeam = (row: LeaguePlayerIdentity) => row.teamId === score.teamId
            && (row.teamSquad || null) === (score.teamSquad || null);
        const sameName = (row: LeaguePlayerIdentity) => normalizedName(score.playerName) !== ''
            && normalizedName(score.playerName) === normalizedName(row.playerName || row.User?.name);
        const candidates = existing.filter(row => sameTeam(row) && sameName(row)
            && (!score.id || row.id === score.id));
        // Only preserve a link from this exact matchup's unchanged score row.
        // A previous link is authoritative; new links require this center/team's roster.
        const previous = candidates.length === 1 ? candidates[0] : undefined;
        const sameMemberTeam = (member: LeagueMemberOption) => member.teamId === score.teamId
            && (member.allSquads || (member.squad || null) === (score.teamSquad || null));
        let userId = score.identityMode === 'GUEST' ? null : score.userId || previous?.userId || null;
        if (!userId && score.identityMode !== 'GUEST') {
            const matches = [...new Set(members.filter(member => sameMemberTeam(member)
                && normalizedName(member.name) === normalizedName(score.playerName)).map(member => member.userId))];
            if (matches.length > 1) {
                throw new Error(`${score.playerName}: 같은 팀에 동명 회원이 여러 명입니다. 회원을 선택하거나 다른 사람이면 게스트를 선택해주세요.`);
            }
            userId = matches[0] || null;
        }
        if (userId) {
            const registered = members.some(member => member.userId === userId && sameMemberTeam(member));
            const alreadyLinked = existing.some(row => row.userId === userId && sameTeam(row));
            if (!registered && !alreadyLinked) {
                throw new Error('해당 팀에 등록된 회원을 선택해주세요.');
            }
        }
        return { ...score, userId };
    });
    const linked = new Set<string>();
    for (const score of resolved) {
        if (!score.userId) continue;
        const key = JSON.stringify([score.teamId, score.teamSquad || null, score.userId]);
        if (linked.has(key)) throw new Error(`${score.playerName}: 같은 회원이 한 경기 명단에 중복되어 있습니다. 동명이인이면 회원 또는 게스트를 구분해주세요.`);
        linked.add(key);
    }
    return resolved;
}
