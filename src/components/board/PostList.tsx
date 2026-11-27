'use client';

import { useState, useEffect } from 'react';
import { getPosts } from '@/app/actions/board';
import { format } from 'date-fns';
import styles from './Board.module.css';

interface PostListProps {
    teamId: string;
    onWriteClick: () => void;
    onPostClick: (postId: string) => void;
}

export default function PostList({ teamId, onWriteClick, onPostClick }: PostListProps) {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    const fetchPosts = async (pageNum: number) => {
        try {
            setLoading(true);
            const res = await getPosts(teamId, pageNum, 10);
            if (pageNum === 1) {
                setPosts(res.posts);
            } else {
                setPosts(prev => [...prev, ...res.posts]);
            }
            setHasMore(res.posts.length === 10);
        } catch (error) {
            console.error("Failed to load posts", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPosts(1);
    }, [teamId]);

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchPosts(nextPage);
    };

    return (
        <div>


            <div className={styles.list}>
                {posts.length === 0 && !loading ? (
                    <div className={styles.empty}>게시글이 없습니다. 첫 글을 작성해보세요!</div>
                ) : (
                    posts.map(post => (
                        <button
                            type="button"
                            key={post.id}
                            onClick={() => onPostClick(post.id)}
                            className={styles.postRow}
                        >
                            <span className={styles.postTitle}>{post.title}</span>
                            <span className={styles.postMeta}>
                                <span className={styles.author}>{post.author.name}</span>
                                <span>{format(new Date(post.createdAt), 'yyyy.MM.dd')}</span>
                            </span>
                        </button>
                    ))
                )}

                {loading && (
                    <div className={styles.loading}>Loading...</div>
                )}

                {!loading && hasMore && (
                    <div className={styles.center}>
                        <button type="button" onClick={handleLoadMore} className={styles.linkButton}>
                            더 보기
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
