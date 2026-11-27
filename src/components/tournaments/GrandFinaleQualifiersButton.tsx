import Link from 'next/link';

interface GrandFinaleQualifiersButtonProps {
    centerId: string;
    tournamentId: string;
}

export default function GrandFinaleQualifiersButton({ centerId, tournamentId }: GrandFinaleQualifiersButtonProps) {
    return (
        <Link
            href={`/centers/${centerId}/tournaments/${tournamentId}/qualifiers`}
            className="btn btn-primary w-full text-sm font-black h-12 shadow-md flex items-center justify-center border-2 border-black bg-indigo-600 hover:bg-indigo-700 text-white mb-3"
        >
            🎓 진출자 명단 현황
        </Link>
    );
}
