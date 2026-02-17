import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export default async function TournamentsPage() {
    const session = await auth();
    if (!session?.user) redirect("/login");

    if (session.user.role === "CENTER_ADMIN") {
        // Check if user has a managed center
        const managedCenter = await prisma.bowlingCenter.findFirst({
            where: { managers: { some: { id: session.user.id } } }
        });

        if (managedCenter) {
            redirect(`/centers/${managedCenter.id}`);
        } else {
            // If they are a center admin but have no center yet? 
            // This shouldn't happen with the current logic but let's redirect to discovery
            redirect("/centers");
        }
    }

    // Regular users and Super Admins (or anyone else) go to discovery
    redirect("/centers");
}
