import { getInquiries } from "@/app/actions/inquiry-actions";
import InquiryPageContent from "@/components/InquiryPageContent";
import { auth } from "@/auth";
import { PUBLIC_ORIGIN } from '@/lib/public-web';

export const metadata = {
    title: "1:1 문의하기 | BowlingManager",
    description: "비회원 이메일 문의와 콘텐츠 정정 안내, 로그인 회원의 1:1 문의 내역을 확인하세요.",
    alternates: { canonical: PUBLIC_ORIGIN + '/inquiry' },
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
