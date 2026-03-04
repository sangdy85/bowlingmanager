import { getInquiries } from "@/app/actions/inquiry-actions";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AboutPageContent from "@/components/AboutPageContent";
import { auth } from "@/auth";

export const metadata = {
    title: "사이트 소개 | BowlingManager",
    description: "BowlingManager 서비스 소개 및 이용 가이드, 문의 게시판입니다.",
};

export default async function AboutPage() {
    const session = await auth();
    const isLoggedIn = !!session?.user;
    const isAdmin = session?.user?.role === 'SUPER_ADMIN';

    const inquiries = await getInquiries();

    return (
        <AboutPageContent
            initialInquiries={inquiries}
            isAdmin={isAdmin}
            isLoggedIn={isLoggedIn}
        />
    );
}
