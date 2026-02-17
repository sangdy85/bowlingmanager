import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import NewTournamentForm from "@/components/tournaments/NewTournamentForm";

export default async function NewTournamentPage({ params }: { params: { id: string } }) {
    const { id: centerId } = await params;
    const session = await auth();

    const center = await prisma.bowlingCenter.findUnique({
        where: { id: centerId },
        include: { managers: true }
    });

    if (!center) notFound();
    if (!center.managers.some(m => m.id === session?.user?.id)) {
        redirect(`/centers/${centerId}`);
    }

    return (
        <div className="max-w-2xl mx-auto py-8">
            <h1 className="page-title mb-8">새 대회 개최</h1>

            <div className="card">
                <NewTournamentForm centerId={centerId} />
            </div>
        </div>
    );
}
