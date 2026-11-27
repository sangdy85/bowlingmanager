import JoinTeamForm from "./JoinTeamForm";
import { normalizeTeamCode } from "@/lib/team-membership";

type PageProps = { searchParams: Promise<{ code?: string | string[] }> };

export default async function JoinTeamPage({ searchParams }: PageProps) {
    const rawCode = (await searchParams).code;
    const initialCode = normalizeTeamCode(Array.isArray(rawCode) ? rawCode[0] : rawCode) ?? "";
    return <JoinTeamForm initialCode={initialCode} />;
}
