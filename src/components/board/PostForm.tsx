'use client';

import { useState } from 'react';
import { createPost } from '@/app/actions/board';

interface PostFormProps {
    teamId: string;
    onCancel: () => void;
    onSuccess: () => void;
}

export default function PostForm({ teamId, onCancel, onSuccess }: PostFormProps) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const validFiles = files.filter(file => {
                if (file.size > 2 * 1024 * 1024) {
                    alert(`'${file.name}' 파일이 2MB를 초과하여 제외됩니다.`);
                    return false;
                }
                return true;
            });
            setSelectedFiles(prev => [...prev, ...validFiles]);
        }
    };

    const uploadImages = async (): Promise<{ url: string; size: number }[]> => {
        const uploadPromises = selectedFiles.map(async (file) => {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Upload failed');
            }

            const data = await response.json();
            return { url: data.url, size: data.size };
        });

        return Promise.all(uploadPromises);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) return;

        setIsSubmitting(true);
        setError('');

        try {
            // Upload images first
            let uploadedImages: { url: string; size: number }[] = [];
            if (selectedFiles.length > 0) {
                uploadedImages = await uploadImages();
            }

            await createPost(teamId, { title, content, images: uploadedImages });
            onSuccess();
        } catch (err: any) {
            console.error(err);
            setError(err.message || '게시글 등록에 실패했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium mb-1">제목</label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="input w-full"
                    placeholder="제목을 입력하세요"
                    required
                />
            </div>
            <div>
                <label className="block text-sm font-medium mb-1">내용</label>
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="input w-full min-h-[200px] resize-y"
                    placeholder="내용을 입력하세요"
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">이미지 첨부</label>
                <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-slate-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-full file:border-0
                        file:text-sm file:font-semibold
                        file:bg-violet-50 file:text-violet-700
                        hover:file:bg-violet-100"
                />
                <p className="text-xs text-muted-foreground mt-1">
                    {selectedFiles.length > 0 ? `${selectedFiles.length}개의 파일 선택됨` : '선택된 파일 없음'}
                </p>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex gap-2 justify-end pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="btn btn-secondary"
                    disabled={isSubmitting}
                >
                    취소
                </button>
                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? '등록 중...' : '등록'}
                </button>
            </div>
        </form>
    );
}
