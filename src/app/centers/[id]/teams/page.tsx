import prisma from "@/lib/prisma";
import { verifyCenterAdmin } from "@/lib/auth-utils";
import { notFound } from "next/navigation";
import CenterTeamsManager from "@/components/tournaments/CenterTeamsManager";

export default async function CenterTeamsPage({ params }: { params: { id: string } }) {
    const { id: centerId } = await params;
    await verifyCenterAdmin(centerId);

    const center = (await prisma.bowlingCenter.findUnique({
        where: { id: centerId },
        include: {
            teams: {
                where: { isActive: true },
                orderBy: { name: 'asc' }
            }
        } as any
    })) as any;

    if (!center) notFound();

    return <CenterTeamsManager center={center} centerId={centerId} />;
}
