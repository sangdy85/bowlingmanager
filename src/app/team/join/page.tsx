'use client';

import { useActionState } from "react";
import { joinTeam } from "@/app/actions/team";
import Link from "next/link";

export default function JoinTeamPage() {
    const [errorMessage, dispatch, isPending] = useActionState(joinTeam, undefined);

    return (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '2rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                <h1 className="text-center mb-4" style={{ fontSize: '1.5rem' }}>팀 가입하기</h1>
                <p className="text-center mb-4" style={{ color: 'var(--secondary-foreground)' }}>
                    전달받은 팀 코드를 입력하여 팀에 합류하세요.
                </p>
                <form action={dispatch} className="flex flex-col gap-4">
                    <div>
                        <label htmlFor="code" className="label">팀 코드</label>
                        <input type="text" id="code" name="code" className="input" placeholder="예: A1B2C3" required style={{ textTransform: 'uppercase' }} />
                    </div>
                    {errorMessage && (
                        <div className="text-destructive text-center" style={{ fontSize: '0.875rem' }}>{errorMessage}</div>
                    )}
                    <button type="submit" className="btn btn-primary w-full">팀 가입하기</button>
                </form>
                <div className="text-center mt-4">
                    <Link href="/team/create" style={{ fontSize: '0.875rem', color: 'var(--primary)' }}>
                        아직 팀이 없으신가요? 팀 만들기 &rarr;
                    </Link>
                </div>
            </div>
        </div>
    );
}
