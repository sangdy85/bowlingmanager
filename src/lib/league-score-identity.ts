export type LeaguePlayerIdentity = {
    id?: string;
    teamId: string;
    teamSquad?: string | null;
    userId?: string | null;
    playerName?: string | null;
    identityMode?: 'GUEST';
    User?: { name?: string | null } | null;
    matchupId?: string;
};

export type LeagueMemberOption = {
    userId: string;
    name: string;
    teamId: string;
    squad: string | null;
    allSquads?: boolean;
};

const normalizedName = (value?: string | null) => value?.trim().normalize('NFC') || '';

export type LeagueRosterName = { teamId: string; name: string };

/** The center's player name is independent of whether a website account exists. */
export function leagueRosterNames(rows: Array<{teamId?: string | null; name?: string | null; playerName?: string | null; User?: {name?: string | null} | null}>): LeagueRosterName[] {
    const names = new Map<string, LeagueRosterName>();
    for (const row of rows) {
        const name = normalizedName(row.playerName || row.name || row.User?.name);
        if (row.teamId && name) names.set(JSON.stringify([row.teamId, name]), {teamId: row.teamId, name});
    }
    return [...names.values()].sort((a,b) => a.name.localeCompare(b.name, 'ko'));
}

export function initializeLeagueTeamRows<T extends LeaguePlayerIdentity>(scores: T[], teamId: string | null, squad?: string | null): T[] {
    return scores.filter(row => row.teamId === teamId && (row.teamSquad || null) === (squad || null))
        .map(row => ({...row, teamSquad: squad || null, playerName: row.playerName || row.User?.name || '', identityMode: undefined}));
}

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
    side?: {teamId: string | null; squad?: string | null},
): T[] {
    if (side) scores = scores.map(score => {
        if (!side.teamId || score.teamId !== side.teamId || (score.teamSquad && score.teamSquad !== (side.squad || null))) {
            throw new Error('대진표에 지정된 팀과 조의 선수만 저장할 수 있습니다.');
        }
        return {...score, teamSquad: side.squad || null};
    });
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
        const name = normalizedName(score.playerName);
        if (!name) {
            const values = score as LeaguePlayerIdentity & {score1?: number;score2?: number;score3?: number;handicap?: number};
            if ([values.score1, values.score2, values.score3, values.handicap].some(value => Number(value || 0) !== 0)) {
                throw new Error('점수 또는 핸디가 입력된 행에는 선수 성명을 입력해주세요.');
            }
            return {...score, playerName: '', userId: null, identityMode: undefined};
        }
        // The entered center/team name is authoritative. A stale account selector
        // must never attach a different player's score to its previous account.
        const suppliedMember = members.filter(member => member.userId === score.userId && sameMemberTeam(member));
        if (score.userId && !suppliedMember.length && !existing.some(row => row.userId === score.userId && sameTeam(row))) {
            throw new Error('해당 팀에 등록된 회원을 선택해주세요.');
        }
        const suppliedMatchesName = suppliedMember.some(member => normalizedName(member.name) === name)
            || candidates.some(row => row.userId === score.userId);
        let userId = (suppliedMatchesName ? score.userId : null) || previous?.userId || null;
        if (!userId) {
            const matches = [...new Set(members.filter(member => sameMemberTeam(member)
                && normalizedName(member.name) === normalizedName(score.playerName)).map(member => member.userId))];
            // Ambiguous website accounts do not block recording a real player.
            // Keep the center/team/name record and leave the account unlinked.
            userId = matches.length === 1 ? matches[0] : null;
        }
        if (userId) {
            const registered = members.some(member => member.userId === userId && sameMemberTeam(member));
            const alreadyLinked = existing.some(row => row.userId === userId && sameTeam(row));
            if (!registered && !alreadyLinked) {
                throw new Error('해당 팀에 등록된 회원을 선택해주세요.');
            }
        }
        return { ...score, playerName: name, userId, identityMode: undefined };
    });
    const linked = new Set<string>();
    const names = new Set<string>();
    for (const score of resolved) {
        if (!score.playerName) continue;
        const nameKey = JSON.stringify([score.teamId, score.teamSquad || null, normalizedName(score.playerName)]);
        if (names.has(nameKey)) throw new Error(`${score.playerName}: 같은 팀의 경기 명단에 이름이 중복되어 있습니다. 동명이인은 구분할 수 있는 이름으로 입력해주세요.`);
        names.add(nameKey);
        if (!score.userId) continue;
        const key = JSON.stringify([score.teamId, score.teamSquad || null, score.userId]);
        if (linked.has(key)) throw new Error(`${score.playerName}: 같은 선수가 한 경기 명단에 중복되어 있습니다.`);
        linked.add(key);
    }
    return resolved;
}

/** Resolve historical names only inside this tournament/team and never across an overlapping match. */
export function createLeagueIdentityResolver(scores: LeaguePlayerIdentity[], members: LeagueMemberOption[] = []) {
    const accounts = new Map<string, Set<string>>();
    const rowsById = new Map(scores.filter(row => row.id).map(row => [row.id!, row]));
    const matchRows = new Map<string, LeaguePlayerIdentity[]>();
    for (const row of scores) {
        if (!row.matchupId) continue;
        const key = JSON.stringify([row.matchupId, row.teamId]);
        matchRows.set(key, [...(matchRows.get(key) || []), row]);
    }
    const keyFor = (row: LeaguePlayerIdentity) => JSON.stringify([row.teamId, normalizedName(row.playerName || row.User?.name)]);
    const add = (key: string, userId: string) => {const ids = accounts.get(key) || new Set<string>(); ids.add(userId); accounts.set(key, ids);};
    for (const row of scores) if (row.userId && normalizedName(row.playerName || row.User?.name)) add(keyFor(row), row.userId);
    for (const member of members) add(JSON.stringify([member.teamId, normalizedName(member.name)]), member.userId);
    return (row: LeaguePlayerIdentity) => {
        let userId = row.userId || null;
        const nameKey = keyFor(row), matches = accounts.get(nameKey);
        if (!userId && matches?.size === 1) {
            const candidate = [...matches][0];
            const matchupId = row.matchupId || (row.id ? rowsById.get(row.id)?.matchupId : undefined);
            const overlap = matchupId && (matchRows.get(JSON.stringify([matchupId, row.teamId])) || []).some(other => other !== row && (!row.id || other.id !== row.id)
                && (other.userId === candidate || keyFor(other) === nameKey));
            if (!overlap) userId = candidate;
        }
        return {userId, key: userId ? `user:${userId}` : `guest:${nameKey}`};
    };
}
