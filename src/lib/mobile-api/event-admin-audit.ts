import { Prisma } from "@prisma/client";

type AuditDb = Partial<Pick<Prisma.TransactionClient, "teamEventAdminAudit">>;

export async function recordEventAdminAudit(
    db: AuditDb,
    input: {
        eventId: string;
        eventTitle: string;
        teamId: string;
        actorUserId: string;
        action: string;
        competitionType: string | null;
        beforeStatus: string | null;
        afterStatus: string | null;
        details?: unknown;
    },
) {
    // Partial keeps the pure synthetic service fixtures migration-independent.
    // Generated production clients always expose this delegate and DB failures roll back the action.
    if (!db.teamEventAdminAudit) return;
    await db.teamEventAdminAudit.create({ data: {
        eventId: input.eventId,
        eventSnapshotId: input.eventId,
        eventTitle: input.eventTitle,
        teamId: input.teamId,
        actorUserId: input.actorUserId,
        action: input.action,
        competitionType: input.competitionType,
        beforeStatus: input.beforeStatus,
        afterStatus: input.afterStatus,
        detailsJson: JSON.stringify(input.details ?? {}),
    } });
}
