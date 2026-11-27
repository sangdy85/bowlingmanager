'use client';

import { useState } from 'react';
import { uploadTournamentAttachment, deleteTournamentAttachment } from '@/app/actions/tournament-center';

interface Attachment {
    id: string;
    name: string;
    url: string;
    type: string;
    size: number | null;
    createdAt: Date;
}

interface TournamentAttachmentManagerProps {
    tournamentId: string;
    attachments: Attachment[];
    isManager: boolean;
}

export default function TournamentAttachmentManager({
    tournamentId,
    attachments,
    isManager
}: TournamentAttachmentManagerProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [loading, setLoading] = useState(false);
    const [newName, setNewName] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [newType, setNewType] = useState('PDF');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            // Auto-fill name if empty
            if (!newName) {
                setNewName(file.name);
            }
            // Auto-detect type
            if (file.type.includes('pdf')) {
                setNewType('PDF');
            } else if (file.type.includes('image')) {
                setNewType('IMAGE');
            } else {
                setNewType('DOC');
            }
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let finalUrl = newUrl;
            let fileSize = null;

            // 1. If file is selected, upload it first
            if (selectedFile) {
                const uploadFormData = new FormData();
                uploadFormData.append('file', selectedFile);

                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: uploadFormData,
                });

                if (!uploadRes.ok) {
                    const err = await uploadRes.json();
                    throw new Error(err.error || '파일 업로드 실패');
                }

                const uploadData = await uploadRes.json();
                finalUrl = uploadData.url;
                fileSize = uploadData.size;
            }

            if (!finalUrl) {
                throw new Error("파일을 선택하거나 URL을 입력해주세요.");
            }

            // 2. Register attachment in DB
            const formData = new FormData();
            formData.append('name', newName);
            formData.append('url', finalUrl);
            formData.append('type', newType);
            if (fileSize) {
                formData.append('size', fileSize.toString());
            }

            await uploadTournamentAttachment(tournamentId, formData);

            // 3. Reset state
            setNewName('');
            setNewUrl('');
            setSelectedFile(null);
            setIsAdding(false);
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("정말 이 첨부파일을 삭제하시겠습니까?")) return;
        setLoading(true);
        try {
            await deleteTournamentAttachment(id);
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {attachments.length > 0 && (
                <div className="pt-6 border-t border-border">
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-primary">
                        📎 대회 관련 첨부 문서 ({attachments.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {attachments.map((file) => (
                            <div key={file.id} className="relative group">
                                <a
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-primary/30 hover:bg-primary/5 transition-all group"
                                >
                                    <span className="text-3xl group-hover:scale-110 transition-transform">
                                        {file.type === 'PDF' ? '📕' : file.type === 'IMAGE' ? '🖼️' : '📄'}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black truncate">{file.name}</p>
                                        <p className="text-[10px] text-secondary-foreground font-medium">
                                            {file.type} • {file.size ? `${(file.size / 1024 / 1024).toFixed(2)}MB` : '대회 요강 문서'}
                                        </p>
                                    </div>
                                </a>
                                {isManager && (
                                    <button
                                        onClick={() => handleDelete(file.id)}
                                        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:scale-110"
                                        title="삭제"
                                        disabled={loading}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isManager && (
                <div className="flex justify-center flex-col items-center gap-4 pt-4">
                    {!isAdding ? (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="btn btn-outline btn-sm gap-2 border-2 px-6 h-10 hover:bg-black hover:text-white transition-all font-bold"
                        >
                            <span>📁</span> 대회 문서/요강 업로드하기
                        </button>
                    ) : (
                        <form onSubmit={handleUpload} className="w-full max-w-md p-6 bg-secondary/5 rounded-2xl border-2 border-dashed border-primary/20 space-y-4">
                            <h4 className="font-bold text-sm text-center">새 문서 추가</h4>
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">파일 선택 (PDF, 이미지 등)</label>
                                    <input
                                        type="file"
                                        onChange={handleFileChange}
                                        className="file-input file-input-bordered file-input-sm w-full font-bold"
                                        accept=".pdf,image/*"
                                    />
                                </div>
                                <div className="divider text-[10px] my-1">OR</div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">또는 외부 URL 입력</label>
                                    <input
                                        type="url"
                                        placeholder="문서 URL (Google Drive 등)"
                                        value={newUrl}
                                        onChange={(e) => setNewUrl(e.target.value)}
                                        className="input input-sm w-full font-medium"
                                        disabled={!!selectedFile}
                                    />
                                </div>
                                <div className="space-y-1 pt-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">문서 명칭</label>
                                    <input
                                        type="text"
                                        placeholder="예: 제1회 대회 요강.pdf"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        className="input input-sm w-full font-black"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">문서 타입</label>
                                    <select
                                        value={newType}
                                        onChange={(e) => setNewType(e.target.value)}
                                        className="select select-sm w-full font-bold"
                                    >
                                        <option value="PDF">PDF 문서</option>
                                        <option value="IMAGE">이미지 파일</option>
                                        <option value="DOC">기타 문서</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsAdding(false);
                                        setSelectedFile(null);
                                    }}
                                    className="btn btn-secondary btn-sm flex-1"
                                    disabled={loading}
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary btn-sm flex-1 font-bold"
                                    disabled={loading}
                                >
                                    {loading ? "등록 중..." : "문서 등록하기"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}
