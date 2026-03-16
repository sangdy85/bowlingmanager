'use client';

import { useState } from 'react';
import { swapMavolousSquadsInWeek16 } from '@/app/actions/round-actions';

export default function TmpFixPage() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleSwap = async () => {
        if (!confirm('정말로 마볼러스 A/B 스쿼드를 교체하시겠습니까?')) return;
        
        setLoading(true);
        try {
            const res = await swapMavolousSquadsInWeek16();
            setResult(res);
        } catch (error: any) {
            setResult({ success: false, message: error.message || '알 수 없는 오류가 발생했습니다.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-red-600">Temporary Production Fix</h1>
            
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
                <p className="font-bold">주의사항:</p>
                <ul className="list-disc ml-5 mt-2">
                    <li>이 페이지는 19차 상주리그 16주차 마볼러스 팀의 스쿼드(A/B)를 교환하기 위한 전용 임시 툴입니다.</li>
                    <li>실행 전 반드시 대상을 다시 한번 확인하시기 바랍니다.</li>
                    <li>작동이 완료되면 이 페이지와 관련 코드는 삭제될 예정입니다.</li>
                </ul>
            </div>

            <div className="bg-white shadow rounded-lg p-6 border">
                <h2 className="text-xl font-semibold mb-4">마볼러스 A/B 스쿼드 교체 (16주차)</h2>
                <div className="space-y-4">
                    <p className="text-gray-600">
                        2번 테이블(Matchup ID: cmm21phl2005513o057v05790)의 스쿼드를 <strong>B → A</strong>로 변경하고,<br />
                        3번 테이블(Matchup ID: cmm21phl2005713o0b8fh1o8q)의 스쿼드를 <strong>A → B</strong>로 변경합니다.
                    </p>
                    
                    <button
                        onClick={handleSwap}
                        disabled={loading}
                        className={`px-6 py-2 rounded font-bold text-white ${
                            loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {loading ? '처리 중...' : '지금 교체 실행하기'}
                    </button>

                    {result && (
                        <div className={`mt-4 p-4 rounded ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {result.message}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
