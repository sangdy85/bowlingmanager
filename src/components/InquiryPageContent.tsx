'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createInquiry, answerInquiry, deleteInquiry } from '@/app/actions/inquiry-actions';

interface InquiryWithAuthor {
    id: string;
    title: string;
    content: string;
    status: string;
    answer: string | null;
    createdAt: Date;
    author: { name: string };
}

export default function InquiryPageContent({
    initialInquiries,
    isAdmin,
    isLoggedIn
}: {
    initialInquiries: any[],
    isAdmin: boolean,
    isLoggedIn: boolean
}) {
    const router = useRouter();
    const [inquiries, setInquiries] = useState<InquiryWithAuthor[]>(initialInquiries);
    const [isPending, startTransition] = useTransition();
    const [adminFilter, setAdminFilter] = useState<'all' | 'pending'>('pending');

    // Filter out nulls defensively
    const validInquiries = Array.isArray(initialInquiries) ? initialInquiries.filter(i => i !== null) : [];
    const sortedInquiries = [...validInquiries].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
    });

    const filteredInquiries = isAdmin && adminFilter === 'pending'
        ? sortedInquiries.filter(i => i.status === 'PENDING')
        : sortedInquiries;

    const [form, setForm] = useState({ title: '', content: '' });

    const handleSubmitInquiry = async (e: React.FormEvent) => {
        e.preventDefault();
        startTransition(async () => {
            const res = await createInquiry(form);
            if (res.success) {
                alert('문의가 등록되었습니다.');
                setForm({ title: '', content: '' });
                router.refresh();
            } else {
                alert(res.error);
            }
        });
    };

    const handleAnswer = async (id: string, answer: string) => {
        if (!answer.trim()) return;
        startTransition(async () => {
            const res = await answerInquiry(id, answer);
            if (res.success) {
                alert('답변이 등록되었습니다.');
                router.refresh();
            } else {
                alert(res.error);
            }
        });
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        startTransition(async () => {
            const res = await deleteInquiry(id);
            if (res.success) {
                router.refresh();
            } else {
                alert(res.error);
            }
        });
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-16">
            <header className="text-center mb-16">
                <h1 className="text-4xl md:text-6xl font-black mb-6 text-slate-900 tracking-tighter">
                    1:1 <span className="text-blue-600">문의하기</span>
                </h1>
                <p className="text-xl text-slate-600 font-medium max-w-3xl mx-auto leading-relaxed">
                    BowlingManager 서비스를 이용하면서 궁금한 점이나 불편한 사항을 남겨주시면<br />
                    신속하고 친절하게 답변해 드리겠습니다.
                </p>
            </header>

            <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">문의 등록 및 내역</h2>

                {isLoggedIn ? (
                    <form onSubmit={handleSubmitInquiry} className="mb-10 p-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        <h3 className="font-semibold mb-4 text-gray-700 font-bold">새로운 문의사항 작성</h3>
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="제목을 입력하세요"
                                required
                                className="w-full p-3 border rounded-md focus:ring-2 focus:ring-primary outline-none text-gray-900"
                                value={form.title}
                                onChange={e => setForm({ ...form, title: e.target.value })}
                            />
                            <textarea
                                placeholder="내용을 상세히 적어주시면 빠르게 답변해 드리겠습니다."
                                required
                                rows={4}
                                className="w-full p-3 border rounded-md focus:ring-2 focus:ring-primary outline-none text-gray-900"
                                value={form.content}
                                onChange={e => setForm({ ...form, content: e.target.value })}
                            />
                            <button
                                type="submit"
                                disabled={isPending}
                                className="btn btn-primary w-full md:w-auto px-10"
                            >
                                {isPending ? '등록 중...' : '문의하기'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="mb-10 p-6 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-100 text-center">
                        문의사항을 작성하려면 먼저 로그인이 필요합니다.
                    </div>
                )}

                <div className="space-y-6">
                    <div className="flex justify-between items-center border-b pb-4">
                        <h3 className="font-bold text-lg text-gray-800">문의 내역</h3>
                        {isAdmin && (
                            <div className="flex bg-gray-100 p-1 rounded-md text-sm border border-gray-200">
                                <button
                                    onClick={() => setAdminFilter('pending')}
                                    className={`px-4 py-1.5 rounded-sm transition-all ${adminFilter === 'pending' ? 'bg-white shadow-sm font-bold text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    미답변
                                </button>
                                <button
                                    onClick={() => setAdminFilter('all')}
                                    className={`px-4 py-1.5 rounded-sm transition-all ${adminFilter === 'all' ? 'bg-white shadow-sm font-bold text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    전체
                                </button>
                            </div>
                        )}
                    </div>

                    {filteredInquiries.length === 0 ? (
                        <p className="text-center py-20 text-gray-400">등록된 문의사항이 없습니다.</p>
                    ) : (
                        filteredInquiries.map(inq => (
                            <div key={inq.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow">
                                <div className="p-5 flex justify-between items-start gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider ${inq.status === 'ANSWERED' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-orange-100 text-orange-700 border border-orange-200'}`}>
                                                {inq.status === 'ANSWERED' ? '답변완료' : '검토중'}
                                            </span>
                                            <h4 className="font-bold text-gray-900 text-lg leading-tight">{inq.title}</h4>
                                        </div>
                                        <div className="text-sm text-gray-500 font-medium">
                                            {inq.author?.name || '익명'} · {inq.createdAt ? new Date(inq.createdAt).toISOString().split('T')[0] : '-'}
                                        </div>
                                    </div>
                                    {isAdmin && (
                                        <button
                                            onClick={() => handleDelete(inq.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            title="문의 삭제"
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" /></svg>
                                        </button>
                                    )}
                                </div>
                                <div className="px-5 pb-5 text-gray-700 text-base leading-relaxed whitespace-pre-wrap border-b border-gray-50">
                                    {inq.content}
                                </div>
                                {inq.answer && (
                                    <div className="p-5 bg-blue-50/50">
                                        <div className="flex items-center gap-2 mb-2 font-black text-blue-800 text-sm">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                                            관리자 답변
                                        </div>
                                        <p className="text-blue-900 leading-relaxed whitespace-pre-wrap">{inq.answer}</p>
                                    </div>
                                )}
                                {isAdmin && inq.status === 'PENDING' && (
                                    <div className="p-5 border-t border-gray-100 bg-gray-50">
                                        <textarea
                                            id={`answer-${inq.id}`}
                                            placeholder="질문에 대한 답변을 입력하세요..."
                                            className="w-full p-4 border border-gray-200 rounded-xl mb-3 focus:ring-2 focus:ring-primary outline-none text-gray-900 bg-white"
                                            rows={3}
                                        />
                                        <div className="flex justify-end">
                                            <button
                                                onClick={() => {
                                                    const el = document.getElementById(`answer-${inq.id}`) as HTMLTextAreaElement;
                                                    handleAnswer(inq.id, el.value);
                                                }}
                                                disabled={isPending}
                                                className="btn btn-primary px-8"
                                            >
                                                답변 등록하기
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="mt-24 pt-8 border-t border-slate-200 flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm font-medium text-slate-500">
                <Link href="/privacy" className="hover:text-blue-600 transition-colors underline underline-offset-4">개인정보처리방침</Link>
                <Link href="/terms" className="hover:text-blue-600 transition-colors underline underline-offset-4">이용약관</Link>
                <span>© {new Date().getFullYear()} BowlingManager. All rights reserved.</span>
            </div>
        </div>
    );
}
