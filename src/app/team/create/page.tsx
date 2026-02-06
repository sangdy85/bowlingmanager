'use client';

import { useActionState } from "react";
import { createTeam } from "@/app/actions/team";
import Link from "next/link";

export default function CreateTeamPage() {
    const [errorMessage, dispatch, isPending] = useActionState(createTeam, undefined);

    return (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '2rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                <h1 className="text-center mb-4" style={{ fontSize: '1.5rem' }}>팀 만들기</h1>
                <p className="text-center mb-4" style={{ color: 'var(--secondary-foreground)' }}>
                    새로운 팀을 만들고 팀원들을 초대하세요.
                </p>
                <form action={dispatch} className="flex flex-col gap-4">
                    <div>
                        <label htmlFor="name" className="label">팀 이름</label>
                        <input type="text" id="name" name="name" className="input" placeholder="예: 스트라이크 300" required />
                    </div>
                    {errorMessage && (
                        <div className="text-destructive text-center" style={{ fontSize: '0.875rem' }}>{errorMessage}</div>
                    )}
                    <button type="submit" className="btn btn-primary w-full">팀 생성하기</button>
                </form>
                <div className="text-center mt-4">
                    <Link href="/team/join" style={{ fontSize: '0.875rem', color: 'var(--primary)' }}>
                        이미 팀 코드가 있으신가요? 팀 가입하기 &rarr;
                    </Link>
                </div>
            </div>
        </div>
    );
}
