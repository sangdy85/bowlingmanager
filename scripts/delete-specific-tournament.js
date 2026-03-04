const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // 1. List tournaments involving "챔프전" or "1회차"
    const ts = await prisma.tournament.findMany({
        where: {
            OR: [
                { name: { contains: '챔프전' } },
                { name: { contains: '1회차' } }
            ]
        },
        select: { id: true, name: true, iteration: true, type: true }
    });

    console.log('--- 검색 결과 ---');
    console.log(JSON.stringify(ts, null, 2));

    // Based on user request "2026년 상반기 챔프전 1회차"
    // Usually "1회차" refers to the iteration.
    const target = ts.find(t => t.name === '2026년 상반기 챔프전' && t.iteration === 1)
        || ts.find(t => t.name.includes('2026') && t.name.includes('상반기') && t.name.includes('챔프전'));

    if (target) {
        console.log(`\n🎯 삭제 대상을 결정했습니다: "${target.name}" (ID: ${target.id})`);
        const deleted = await prisma.tournament.delete({ where: { id: target.id } });
        console.log(`🚀 성공적으로 삭제되었습니다: "${deleted.name}"`);
    } else {
        console.log('\n❌ 정확한 삭제 대상을 찾을 수 없습니다. 위 목록에서 ID를 골라 직접 삭제해야 할 수도 있습니다.');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
