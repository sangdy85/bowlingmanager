export type LaneMoveType = 'RIGHT' | 'LEFT' | 'CROSS';

interface LaneMovementInput {
    lane: number;
    firstLane: number;
    lastLane: number;
    moveType?: LaneMoveType | string | null;
    tableCount?: number | null;
}

interface GameLaneAssignmentInput extends LaneMovementInput {
    slot: number;
    gameCount: number;
}

export interface GameLaneAssignment {
    gameNumber: number;
    lane: number;
    slot: number;
}

function assertSafeInteger(value: number, name: string) {
    if (!Number.isSafeInteger(value)) {
        throw new RangeError(`${name} must be a safe integer.`);
    }
}

function validateLaneRange(lane: number, firstLane: number, lastLane: number) {
    assertSafeInteger(firstLane, 'firstLane');
    assertSafeInteger(lastLane, 'lastLane');
    assertSafeInteger(lane, 'lane');

    if (firstLane > lastLane) {
        throw new RangeError('firstLane must be less than or equal to lastLane.');
    }
    if (lane < firstLane || lane > lastLane) {
        throw new RangeError('lane must be within the configured lane range.');
    }
}

export function wrapLane(lane: number, firstLane: number, lastLane: number) {
    assertSafeInteger(lane, 'lane');
    assertSafeInteger(firstLane, 'firstLane');
    assertSafeInteger(lastLane, 'lastLane');

    if (firstLane > lastLane) {
        throw new RangeError('firstLane must be less than or equal to lastLane.');
    }

    const totalLanes = lastLane - firstLane + 1;
    return firstLane + (((lane - firstLane) % totalLanes) + totalLanes) % totalLanes;
}

export function calculateMovedLane({
    lane,
    firstLane,
    lastLane,
    moveType,
    tableCount,
}: LaneMovementInput) {
    validateLaneRange(lane, firstLane, lastLane);

    if (moveType === undefined || moveType === null || moveType === '') {
        return lane;
    }
    if (moveType !== 'RIGHT' && moveType !== 'LEFT' && moveType !== 'CROSS') {
        throw new RangeError(`Unsupported lane move type: ${moveType}`);
    }
    if (tableCount === undefined || tableCount === null || !Number.isSafeInteger(tableCount) || tableCount < 1) {
        throw new RangeError('tableCount must be a positive safe integer when lane movement is enabled.');
    }

    const laneOffset = tableCount * 2;
    if (!Number.isSafeInteger(laneOffset)) {
        throw new RangeError('tableCount produces an unsafe lane offset.');
    }

    const delta = moveType === 'RIGHT'
        ? laneOffset
        : moveType === 'LEFT'
            ? -laneOffset
            : lane % 2 === 1
                ? laneOffset
                : -laneOffset;

    return wrapLane(lane + delta, firstLane, lastLane);
}

export function calculateGameLaneAssignments({
    lane,
    slot,
    gameCount,
    firstLane,
    lastLane,
    moveType,
    tableCount,
}: GameLaneAssignmentInput): GameLaneAssignment[] {
    validateLaneRange(lane, firstLane, lastLane);
    assertSafeInteger(slot, 'slot');
    assertSafeInteger(gameCount, 'gameCount');
    if (slot < 1) throw new RangeError('slot must be a positive integer.');
    if (gameCount < 1) throw new RangeError('gameCount must be a positive integer.');

    const assignments: GameLaneAssignment[] = [];
    let currentLane = lane;
    for (let gameNumber = 1; gameNumber <= gameCount; gameNumber++) {
        assignments.push({ gameNumber, lane: currentLane, slot });
        if (gameNumber < gameCount) {
            currentLane = calculateMovedLane({
                lane: currentLane,
                firstLane,
                lastLane,
                moveType,
                tableCount,
            });
        }
    }
    return assignments;
}
