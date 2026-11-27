import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export default async function TournamentsPage() {
    const session = await auth();

    if (session?.user?.role === "CENTER_ADMIN") {
        // Check if user has a managed center
        const managedCenter = await prisma.bowlingCenter.findFirst({
            where: { managers: { some: { id: session.user.id } } }
        });

        if (managedCenter) {
            redirect(`/centers/${managedCenter.id}`);
        }
    }

    // Guests, Regular users, and Super Admins go directly to public centers & tournaments list
    redirect("/centers");
}
