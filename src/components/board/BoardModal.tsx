'use client';

import { useState, useEffect } from 'react';
import PostList from './PostList';
import PostForm from './PostForm';
import PostDetail from './PostDetail';

interface BoardModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamId: string;
    initialViewMode?: ViewMode;
}

type ViewMode = 'LIST' | 'WRITE' | 'DETAIL';

export default function BoardModal({ isOpen, onClose, teamId, initialViewMode = 'LIST' }: BoardModalProps) {
    const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setViewMode(initialViewMode);
            setSelectedPostId(null);
        }
    }, [isOpen, initialViewMode]);

    if (!isOpen) return null;

    const handleWriteClick = () => setViewMode('WRITE');
    const handlePostClick = (postId: string) => {
        setSelectedPostId(postId);
        setViewMode('DETAIL');
    };
    const handleBackToList = () => {
        setViewMode('LIST');
        setSelectedPostId(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-background w-full max-w-2xl rounded-xl shadow-lg flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-muted/30">
                    <h2 className="text-lg font-bold">
                        {viewMode === 'WRITE' && '게시글 작성'}
                        {viewMode === 'DETAIL' && '게시글 보기'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-full transition-colors font-bold text-lg leading-none"
                    >
                        X
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {viewMode === 'LIST' && (
                        <PostList
                            teamId={teamId}
                            onWriteClick={handleWriteClick}
                            onPostClick={handlePostClick}
                        />
                    )}
                    {viewMode === 'WRITE' && (
                        <PostForm
                            teamId={teamId}
                            onCancel={handleBackToList}
                            onSuccess={handleBackToList}
                        />
                    )}
                    {viewMode === 'DETAIL' && selectedPostId && (
                        <PostDetail
                            postId={selectedPostId}
                            teamId={teamId}
                            onBack={handleBackToList}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
