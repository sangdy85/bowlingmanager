import { getInquiries } from "@/app/actions/inquiry-actions";
import AboutPageContent from "@/components/AboutPageContent";
import { auth } from "@/auth";
import { PUBLIC_ORIGIN } from "@/lib/public-web";

export const metadata = {
    title: "이용 방법 | BowlingManager",
    alternates: { canonical: `${PUBLIC_ORIGIN}/about` },
    description: "BowlingManager 이용 방법 및 상세 가이드, 문의 게시판입니다.",
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
