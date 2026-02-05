'use client';

import { useState, useEffect } from 'react';
import { getPosts } from '@/app/actions/board';
import { format } from 'date-fns';

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
        <div className="space-y-4">


            <div className="space-y-2">
                {posts.length === 0 && !loading ? (
                    <div className="text-center py-8 text-muted-foreground bg-muted/10 rounded-lg">
                        게시글이 없습니다. 첫 글을 작성해보세요!
                    </div>
                ) : (
                    posts.map(post => (
                        <div
                            key={post.id}
                            onClick={() => onPostClick(post.id)}
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

                {loading && (
                    <div className="text-center py-4">
                        <span className="loading-spinner">Loading...</span>
                    </div>
                )}

                {!loading && hasMore && (
                    <div className="text-center pt-2">
                        <button
                            onClick={handleLoadMore}
                            className="text-sm text-primary hover:underline"
                        >
                            더 보기
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
