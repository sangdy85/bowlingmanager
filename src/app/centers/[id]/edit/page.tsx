import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { updateBowlingCenter } from "@/app/actions/center";
import styles from "./CenterEdit.module.css";
import BandIntegrationSettings from "@/components/centers/BandIntegrationSettings";

export default async function CenterEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ band?: string }> }) {
    const { id } = await params;
    const { band } = await searchParams;
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/login");
    }

    const center = await prisma.bowlingCenter.findUnique({
        where: { id },
        include: {
            managers: true,
            bandConnection: {
                select: { bandKey: true, bandName: true, bandCoverUrl: true, enabled: true, autoRecruitment: true, autoFinalResult: true, doPush: true, connectedAt: true }
            }
        }
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
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerMain}>
                    <p className={styles.eyebrow}>CENTER SETTINGS</p>
                    <h1 className={styles.title}>볼링장 정보 수정</h1>
                </div>
                <Link href={`/centers/${id}`} className={`btn btn-secondary ${styles.cancelButton}`}>
                    취소
                </Link>
            </header>

            <form action={handleSubmit} className={`card ${styles.form}`}>
                <div className={styles.field}>
                    <label htmlFor="name" className="text-sm font-medium">볼링장명 <span className={styles.required}>*</span></label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        defaultValue={center.name}
                        className="input w-full"
                        required
                    />
                </div>

                <div className={styles.field}>
                    <label htmlFor="address" className="text-sm font-medium">주소 <span className={styles.required}>*</span></label>
                    <input
                        type="text"
                        id="address"
                        name="address"
                        defaultValue={center.address}
                        className="input w-full"
                        required
                    />
                </div>

                <div className={styles.field}>
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

                <div className={styles.field}>
                    <label htmlFor="description" className="text-sm font-medium">볼링장 소개</label>
                    <textarea
                        id="description"
                        name="description"
                        defaultValue={center.description || ""}
                        className="input w-full min-h-[150px] py-2"
                        placeholder="회원님들께 보여줄 볼링장 소개를 작성해주세요."
                    />
                </div>

                <div className={styles.submitArea}>
                    <button type="submit" className={`btn btn-primary ${styles.submitButton}`}>
                        정보 저장하기
                    </button>
                </div>
            </form>

            <BandIntegrationSettings
                centerId={id}
                oauthResult={band}
                connection={center.bandConnection ? {
                    ...center.bandConnection,
                    connectedAt: center.bandConnection.connectedAt.toISOString(),
                } : null}
            />
        </div>
    );
}
