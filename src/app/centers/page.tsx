import prisma from "@/lib/prisma";
import Link from "next/link";

export default async function CentersDiscoveryPage() {
    const centers = await prisma.bowlingCenter.findMany({
        orderBy: { name: 'asc' },
    });

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="page-title mb-8">볼링장 둘러보기</h1>

            <div className="grid gap-6">
                {centers.length === 0 ? (
                    <div className="card p-12 text-center text-secondary-foreground">
                        아직 등록된 볼링장이 없습니다.
                    </div>
                ) : (
                    centers.map((center) => (
                        <Link
                            key={center.id}
                            href={`/centers/${center.id}`}
                            className="card p-6 flex justify-between items-center hover:bg-secondary/20 transition-colors"
                        >
                            <div>
                                <h3 className="text-xl font-bold mb-1">{center.name}</h3>
                                <p className="text-secondary-foreground text-sm">{center.address}</p>
                            </div>
                            <div className="text-primary font-semibold">정보 보기 →</div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    );
}
