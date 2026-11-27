'use client';

import CopyButton from "./CopyButton";

interface TeamCodeSectionProps {
    code: string;
}

export default function TeamCodeSection({ code }: TeamCodeSectionProps) {
    return (
        <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
            <p className="text-sm text-secondary-foreground">
                코드: <code className="font-bold text-foreground">{code}</code>
            </p>
            <div onClick={(e) => e.stopPropagation()}>
                <CopyButton text={code} />
            </div>
        </div>
    );
}
