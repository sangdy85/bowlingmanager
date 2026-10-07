'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import PostList from './PostList';
import PostForm from './PostForm';
import PostDetail from './PostDetail';
import styles from './Board.module.css';

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
        setViewMode('recent');
    };

    return (
        <section className={`card ${styles.board}`}>
            <header className={styles.header}>
                <div className={styles.heading}>
                    <svg
                        className={styles.icon}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                    <h3 className={styles.title}>팀 게시판</h3>
                </div>

                <div className={styles.actions}>
                    <button
                        type="button"
                        onClick={() => setViewMode('write')}
                        className={`btn ${styles.actionButton} ${viewMode === 'write' ? 'btn-primary' : 'btn-secondary'}`}
                    >
                        ✏️ 글쓰기
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className={`btn ${styles.actionButton} ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                    >
                        📋 목록보기
                    </button>
                </div>
            </header>

            <div className={styles.content}>
                {viewMode === 'write' && (
                    <PostForm
                        teamId={teamId}
                        onCancel={handleBackToRecent}
                        onSuccess={handleSuccess}
                    />
                )}

                {viewMode === 'detail' && selectedPostId && (
                    <PostDetail
                        postId={selectedPostId}
                        teamId={teamId}
                        onBack={handleBackToRecent}
                    />
                )}

                {viewMode === 'list' && (
                    <div className={styles.listView}>
                        <PostList
                            teamId={teamId}
                            onWriteClick={() => setViewMode('write')}
                            onPostClick={handlePostClick}
                        />
                        <div className={styles.center}>
                            <button type="button" onClick={handleBackToRecent} className={styles.linkButton}>
                                닫기 · 최근글 보기
                            </button>
                        </div>
                    </div>
                )}

                {viewMode === 'recent' && (
                    <>
                        <p className={styles.sectionLabel}>최근 게시글</p>
                        {recentPosts.length === 0 ? (
                            <div className={styles.empty}>등록된 게시물이 없습니다.</div>
                        ) : (
                            <div className={styles.list}>
                                {recentPosts.map(post => (
                                    <button
                                        type="button"
                                        key={post.id}
                                        onClick={() => handlePostClick(post.id)}
                                        className={styles.postRow}
                                    >
                                        <span className={styles.postTitle}>{post.title}</span>
                                        <span className={styles.postMeta}>
                                            <span className={styles.author}>{post.author.name}</span>
                                            <span>{format(new Date(post.createdAt), 'yyyy.MM.dd')}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}
