'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import PostList from './PostList';
import PostForm from './PostForm';
import PostDetail from './PostDetail';

interface PostSummary {
    id: string;
    title: string;
    createdAt: Date;
    author: { name: string | null };
}

interface TeamBoardSectionProps {
    teamId: string;
    recentPosts: PostSummary[];
}

type ViewMode = 'recent' | 'write' | 'detail' | 'list';

export default function TeamBoardSection({ teamId, recentPosts }: TeamBoardSectionProps) {
    const [viewMode, setViewMode] = useState<ViewMode>('recent');
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

    const handlePostClick = (postId: string) => {
        setSelectedPostId(postId);
        setViewMode('detail');
    };

    const handleBackToRecent = () => {
        setViewMode('recent');
        setSelectedPostId(null);
    };

    const handleSuccess = () => {
        // Refresh? Server action usually revalidates path.
        // We might want to switch back to 'list' if came from there, but 'recent' is safe default.
        setViewMode('recent');
    };

    return (
        <div className="card w-full p-6 mb-8 bg-card text-card-foreground shadow-sm border border-border/50">
            {/* Header with Buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-border/50 pb-4 gap-4">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg
                        style={{ width: '22px', height: '22px', minWidth: '22px', color: '#ef4444' }}
                        className="flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                    <h3 className="text-xl font-bold" style={{ lineHeight: '1', margin: 0 }}>팀 게시판</h3>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => setViewMode('write')}
                        className={`flex-1 sm:flex-none btn btn-sm ${viewMode === 'write' ? 'btn-primary' : 'btn-outline'}`}
                    >
                        ✏️ 글쓰기
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`flex-1 sm:flex-none btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`}
                    >
                        📋 목록보기
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[200px]">
                {viewMode === 'write' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                        <PostForm
                            teamId={teamId}
                            onCancel={handleBackToRecent}
                            onSuccess={handleSuccess}
                        />
                    </div>
                )}

                {viewMode === 'detail' && selectedPostId && (
                    <PostDetail
                        postId={selectedPostId}
                        teamId={teamId}
                        onBack={handleBackToRecent}
                    />
                )}

                {viewMode === 'list' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200" style={{ marginTop: '60px' }}>
                        {/* Inline Full List */}
                        <PostList
                            teamId={teamId}
                            onWriteClick={() => setViewMode('write')} // Passed but maybe unused inside
                            onPostClick={handlePostClick}
                        />
                        <div className="mt-4 text-center">
                            <button onClick={handleBackToRecent} className="text-sm text-secondary-foreground hover:underline">
                                닫기 (최근글 보기)
                            </button>
                        </div>
                    </div>
                )}

                {viewMode === 'recent' && (
                    <div className="space-y-3 animate-in fade-in duration-300">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">최근 게시글</h4>
                        {recentPosts.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8 text-sm bg-muted/20 rounded-lg">
                                등록된 게시물이 없습니다.
                            </div>
                        ) : (
                            recentPosts.map(post => (
                                <div
                                    key={post.id}
                                    onClick={() => handlePostClick(post.id)}
                                    className="group flex justify-between items-center p-3 hover:bg-muted/50 rounded-lg cursor-pointer transition-all border border-transparent hover:border-border/50"
                                >
                                    <span className="font-medium text-sm group-hover:text-primary transition-colors truncate flex-1 mr-4">
                                        {post.title}
                                    </span>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground whitespace-nowrap">
                                        <span className="font-medium text-foreground/80">{post.author.name}</span>
                                        <span className="opacity-70">{format(new Date(post.createdAt), 'yyyy.MM.dd')}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
