import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import AddScoreForm from "@/components/AddScoreForm";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function AddScorePage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    // Fetch teams where user is owner or manager
    const myMemberships = await prisma.teamMember.findMany({
        where: {
            userId: session.user.id,
            team: {
                OR: [
                    { ownerId: session.user.id },
                    { managers: { some: { id: session.user.id } } }
                ]
            }
        },
        include: {
            team: {
                include: {
                    members: {
                        include: { user: true }
                    }
                }
            }
        }
    });

    if (myMemberships.length === 0) {
        redirect("/dashboard");
    }

    const teams = myMemberships.map(membership => ({
        id: membership.team.id,
        name: membership.team.name,
        members: membership.team.members.map(m => ({
            id: m.userId,
            name: m.alias || m.user.name,
            // Add other member props if needed by AddScoreForm, checking its interface
        }))
    }));

    return (
        <AddScoreForm teams={teams} currentUserId={session.user.id} />
    );
}
