import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { updateBowlingCenter } from "@/app/actions/center";

export default async function CenterEditPage({ params }: { params: { id: string } }) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    const center = await prisma.bowlingCenter.findUnique({
        where: { id },
        include: { managers: true }
    });

    if (!center) notFound();

    const isManager = center.managers.some(m => m.id === session.user.id) || center.ownerId === session.user.id;
    if (!isManager) {
        redirect(`/centers/${id}`);
    }

    const handleSubmit = async (formData: FormData) => {
        "use server";
        try {
            await updateBowlingCenter(id, formData);
            redirect(`/centers/${id}`);
        } catch (error: any) {
            // In a real scenario, you'd handle this better, but for simplicity:
            throw error;
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-12 px-4">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">볼링장 정보 수정</h1>
                <Link href={`/centers/${id}`} className="btn btn-secondary text-sm">
                    취소
                </Link>
            </div>

            <form action={handleSubmit} className="space-y-6 card p-8">
                <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">볼링장명 <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        defaultValue={center.name}
                        className="input w-full"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="address" className="text-sm font-medium">주소 <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        id="address"
                        name="address"
                        defaultValue={center.address}
                        className="input w-full"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="phone" className="text-sm font-medium">전화번호</label>
                    <input
                        type="text"
                        id="phone"
                        name="phone"
                        defaultValue={center.phone || ""}
                        className="input w-full"
                        placeholder="예: 02-1234-5678"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor="description" className="text-sm font-medium">볼링장 소개</label>
                    <textarea
                        id="description"
                        name="description"
                        defaultValue={center.description || ""}
                        className="input w-full min-h-[150px] py-2"
                        placeholder="회원님들께 보여줄 볼링장 소개를 작성해주세요."
                    />
                </div>

                <div className="pt-4">
                    <button type="submit" className="btn btn-primary w-full h-12 text-lg">
                        정보 저장하기
                    </button>
                </div>
            </form>
        </div>
    );
}
