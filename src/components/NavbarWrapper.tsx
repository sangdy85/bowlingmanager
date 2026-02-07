import { auth, signOut } from "@/auth";
import NavbarClient from "./Navbar";

export default async function Navbar() {
    const session = await auth();
    const isLoggedIn = !!session?.user;

    const signOutAction = async () => {
        'use server';
        await signOut({ redirectTo: "/" });
    };

    return <NavbarClient isLoggedIn={isLoggedIn} signOutAction={signOutAction} />;
}
