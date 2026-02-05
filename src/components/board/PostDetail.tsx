'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { deletePost, getPost } from '@/app/actions/board';

interface PostDetailProps {
    postId: string;
    teamId: string;
    onBack: () => void;
}

export default function PostDetail({ postId, teamId, onBack }: PostDetailProps) {
    const [post, setPost] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        async function fetchPost() {
            try {
                const data = await getPost(postId);
                if (isMounted) {
                    setPost(data);
                }
            } catch (error) {
                console.error("Failed to fetch post", error);
            } finally {
                if (isMounted) setLoading(false);
            }
        }
        fetchPost();
        return () => { isMounted = false; };
    }, [postId]);

    if (loading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
    if (!post) return <div className="text-center py-12 text-muted-foreground">게시글을 찾을 수 없습니다.</div>;

    return (
        <article className="animate-in fade-in slide-in-from-top-4 duration-300">
            <h3 className="text-xl font-bold mb-4 border-b border-border/50 pb-2">{post.title}</h3>

            <div className="whitespace-pre-wrap min-h-[100px] text-sm leading-relaxed text-foreground/90 mb-6">
                {post.content}
            </div>

            {post.images && post.images.length > 0 && (
                <div className="flex flex-col gap-4 mb-6">
                    {post.images.map((img: any) => (
                        <div key={img.id} className="relative rounded-lg overflow-hidden border border-border/50 bg-muted/20">
                            <img
                                src={img.url}
                                alt="첨부 이미지"
                                className="w-full h-auto object-contain max-h-[600px]"
                                loading="lazy"
                            />
                        </div>
                    ))}
                </div>
            )}

            <div className="flex justify-between items-center text-xs text-muted-foreground border-t border-border/50 pt-4 mb-6">
                <div className="flex gap-3">
                    <span className="font-semibold text-foreground/80">{post.author.name}</span>
                    <span className="opacity-70">{format(new Date(post.createdAt), 'yyyy.MM.dd HH:mm')}</span>
                </div>
                {/* Delete button (simple client checks, real check on server) */}
                <button
                    onClick={async () => {
                        if (confirm('정말 삭제하시겠습니까?')) {
                            await deletePost(postId, teamId);
                            onBack();
                        }
                    }}
                    className="text-red-500 hover:text-red-600 hover:underline transition-colors"
                >
                    삭제
                </button>
            </div>

            <div className="flex justify-center">
                <button
                    onClick={onBack}
                    className="btn btn-secondary w-full sm:w-auto px-8"
                >
                    목록으로
                </button>
            </div>
        </article>
    );
}
