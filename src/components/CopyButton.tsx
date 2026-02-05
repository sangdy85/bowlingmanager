'use client';

import { useState } from "react";

export default function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy team code', err);
        }
    };

    return (
        <button
            onClick={handleCopy}
            className="text-xs bg-muted hover:bg-muted/80 px-2 py-1 rounded border border-border transition-colors w-[60px]"
            title="코드를 클립보드에 복사"
        >
            {copied ? (
                <span className="text-green-500 font-bold">복사됨!</span>
            ) : (
                "복사"
            )}
        </button>
    );
}
