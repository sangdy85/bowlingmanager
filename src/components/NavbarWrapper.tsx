import { auth, signOut } from "@/auth";
import NavbarClient from "./Navbar";

export default async function Navbar() {
    const session = await auth();

    return <NavbarClient
        isLoggedIn={!!session}
        userRole={session?.user?.role}
    />;
}
