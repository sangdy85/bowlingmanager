import { getInquiries } from "@/app/actions/inquiry-actions";
import InquiryPageContent from "@/components/InquiryPageContent";
import { auth } from "@/auth";

export const metadata = {
    title: "1:1 문의하기 | BowlingManager",
    description: "BowlingManager 서비스 이용 관련 1:1 문의 게시판입니다.",
};

export default async function InquiryPage() {
    const session = await auth();
    const isLoggedIn = !!session?.user;
    const isAdmin = session?.user?.role === 'SUPER_ADMIN';

    const inquiries = await getInquiries();

    return (
        <InquiryPageContent
            initialInquiries={inquiries}
            isAdmin={isAdmin}
            isLoggedIn={isLoggedIn}
        />
    );
}
