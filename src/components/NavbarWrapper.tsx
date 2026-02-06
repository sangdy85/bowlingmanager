import { auth, signOut } from "@/auth";
import NavbarClient from "./Navbar";

export default async function Navbar() {
    let session = null;
    try {
        session = await auth();
    } catch (e) {
        console.error("Failed to fetch session:", e);
    }
    const isLoggedIn = !!session?.user;

    const signOutAction = async () => {
        'use server';
        await signOut({ redirectTo: "/" });
    };

    return <NavbarClient isLoggedIn={isLoggedIn} signOutAction={signOutAction} />;
}
