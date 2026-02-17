'use client';

import { useState, useTransition } from "react";
import { searchUsers, addCenterMember } from "@/app/actions/center-members";

interface User {
    id: string;
    name: string;
    email: string;
}

export default function MemberSearchModal({ centerId }: { centerId: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (query.length < 2) return;

        setIsSearching(true);
        setError(null);
        try {
            const users = await searchUsers(query);
            setResults(users);
        } catch (err: any) {
            setError(err.message || "검색 중 오류가 발생했습니다.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleAdd = async (userId: string) => {
        setError(null);
        startTransition(async () => {
            try {
                await addCenterMember(centerId, userId);
                alert("회원이 성공적으로 추가되었습니다.");
                // Optionally close modal or clear results
                setQuery("");
                setResults([]);
                setIsOpen(false);
            } catch (err: any) {
                setError(err.message || "회원 추가 중 오류가 발생했습니다.");
            }
        });
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="btn btn-primary w-full"
            >
                회원 검색 및 추가
            </button>

            {isOpen && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-md">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-lg">회원 검색 및 추가</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="btn btn-sm btn-circle btn-ghost"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                            <input
                                type="text"
                                className="input input-bordered flex-1"
                                placeholder="이름 또는 이메일 입력 (2자 이상)"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                autoFocus
                            />
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={isSearching || query.length < 2}
                            >
                                {isSearching ? "..." : "검색"}
                            </button>
                        </form>

                        {error && (
                            <div className="alert alert-error mb-4 text-sm py-2">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {results.length === 0 && !isSearching && query.length >= 2 && (
                                <p className="text-center text-secondary-foreground py-4 text-sm">
                                    검색 결과가 없습니다.
                                </p>
                            )}

                            {results.map((user) => (
                                <div key={user.id} className="flex items-center justify-between p-3 bg-secondary/10 rounded-lg hover:bg-secondary/20 transition-colors">
                                    <div className="min-w-0">
                                        <div className="font-bold truncate text-sm">{user.name}</div>
                                        <div className="text-[10px] text-secondary-foreground truncate">{user.email}</div>
                                    </div>
                                    <button
                                        onClick={() => handleAdd(user.id)}
                                        className="btn btn-primary btn-xs font-black h-8 px-3"
                                        disabled={isPending}
                                    >
                                        {isPending ? "..." : "추가"}
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="modal-action mt-6">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="btn btn-ghost btn-sm"
                            >
                                닫기
                            </button>
                        </div>
                    </div>
                    <div className="modal-backdrop" onClick={() => setIsOpen(false)}></div>
                </div>
            )}
        </>
    );
}
