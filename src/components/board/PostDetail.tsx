'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { deletePost, getPost } from '@/app/actions/board';
import styles from './Board.module.css';

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

    if (loading) return <div className={styles.loading}>Loading...</div>;
    if (!post) return <div className={styles.empty}>게시글을 찾을 수 없습니다.</div>;

    return (
        <article>
            <h3 className={styles.detailTitle}>{post.title}</h3>

            <div className={styles.detailContent}>
                {post.content}
            </div>

            {post.images && post.images.length > 0 && (
                <div className={styles.images}>
                    {post.images.map((img: any) => (
                        <div key={img.id} className={styles.imageFrame}>
                            <a 
                                href={img.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className={styles.imageLink}
                                title="이미지 크게 보기"
                            >
                                <img
                                    src={img.url}
                                    alt="첨부 이미지"
                                    className={styles.image}
                                    loading="lazy"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        if (target.src.includes('/uploads/')) {
                                            target.src = target.src.replace('/uploads/', '/api/images/');
                                        } else {
                                            target.style.display = 'none';
                                        }
                                    }}
                                />
                            </a>
                        </div>
                    ))}
                </div>
            )}

            <div className={styles.detailMeta}>
                <div className={styles.detailMetaLeft}>
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
                    className={styles.deleteButton}
                >
                    삭제
                </button>
            </div>

            <div className={styles.backArea}>
                <button
                    onClick={onBack}
                    className="btn btn-secondary"
                >
                    목록으로
                </button>
            </div>
        </article>
    );
}
