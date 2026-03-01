'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createTournament } from '@/app/actions/tournament-center';

export default function NewTournamentForm({ centerId }: { centerId: string }) {
    const [type, setType] = useState('LEAGUE');
    const [iteration, setIteration] = useState(1);

    return (
        <form action={createTournament.bind(null, centerId)} className="space-y-6">
            <div>
                <label className="label">대회 유형</label>
                <select
                    name="type"
                    className="input"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    required
                >
                    <option value="LEAGUE">상주리그 (팀 대항 풀리그)</option>
                    <option value="CHAMP">챔프전</option>
                    <option value="EVENT">이벤트전 (단발성 경기)</option>
                    <option value="CUSTOM">커스텀 모드 (별도 개발 예정)</option>
                </select>
            </div>

            {type === 'LEAGUE' ? (
                <div className="space-y-4">
                    <div>
                        <label className="label">회차 (숫자만 입력)</label>
                        <div className="flex items-center gap-3">
                            <span className="text-xl font-bold shrink-0">제</span>
                            <div style={{ width: '80px', minWidth: '80px' }} className="shrink-0">
                                <input
                                    name="iteration"
                                    type="number"
                                    className="input text-center !w-full !mb-0"
                                    value={iteration}
                                    onChange={(e) => setIteration(parseInt(e.target.value) || 0)}
                                    required
                                />
                            </div>
                            <span className="text-xl font-bold shrink-0 whitespace-nowrap">회차 상주리그</span>
                        </div>
                    </div>

                    <p className="text-xs text-secondary-foreground">
                        💡 대회 명칭과 주차별 일정이 자동으로 만들어집니다.
                    </p>
                </div>
            ) : (
                !['CUSTOM', 'EVENT'].includes(type) && (
                    <div>
                        <label className="label">대회 명칭</label>
                        <input name="name" type="text" className="input" placeholder="예: 2024 볼링 매니저 오픈" required />
                    </div>
                )
            )}

            {!['CUSTOM', 'EVENT'].includes(type) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="label">{type === 'CHAMP' ? '시작 일자' : '시작 날짜'}</label>
                        <input name="startDate" type="date" className="input" required />
                    </div>
                    <div>
                        <label className="label">{type === 'CHAMP' ? '종료 일자' : '종료 날짜'}</label>
                        <input name="endDate" type="date" className="input" required />
                    </div>
                </div>
            )}

            {type === 'CHAMP' && (
                <div className="space-y-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label">일시 (텍스트 입력 가능)</label>
                            <input name="startDateText" type="text" className="input" placeholder="예: 매주 수요일 오전 10시" />
                        </div>
                        <div>
                            <label className="label">대회 시간 (공통 시작 시간)</label>
                            <input name="leagueTime" type="time" className="input" required />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label">경기 방식 (게임 수)</label>
                            <select name="gameCount" className="input" defaultValue={3}>
                                {[1, 2, 3, 4, 5].map(n => (
                                    <option key={n} value={n}>{n}게임</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="label">참가 인원 (최대 정원)</label>
                            <input name="maxParticipants" type="number" className="input" placeholder="예: 48" min="1" required />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label">참가 대상</label>
                            <input name="target" type="text" className="input" placeholder="예: 본 센터 상주 클럽 회원" />
                        </div>
                        <div>
                            <label className="label">참가비</label>
                            <input name="entryFeeText" type="text" className="input" placeholder="예: 30,000원" />
                        </div>
                    </div>

                    <div>
                        <label className="label">입금계좌</label>
                        <input name="bankAccount" type="text" className="input" placeholder="예: 국민은행 123-456-7890 (홍길동)" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label">핸디 적용 안내</label>
                            <input name="handicapInfo" type="text" className="input" placeholder="예: 센터 핸디 적용" />
                        </div>
                        <div>
                            <label className="label">마이너스 핸디 안내</label>
                            <input name="minusHandicapInfo" type="text" className="input" placeholder="예: 없음" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label">대회 패턴</label>
                            <input name="pattern" type="text" className="input" placeholder="예: 42피트 정비" />
                        </div>
                        <div>
                            <label className="label">경기 회차 수 (Round)</label>
                            <input name="roundCount" type="number" className="input" placeholder="예: 3" defaultValue={1} required />
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg">
                        <label className="label !mb-3">왕중왕전 진행 여부</label>
                        <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="hasGrandFinale" value="NONE" defaultChecked />
                                <span className="text-sm">없음</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="hasGrandFinale" value="CUMULATIVE" />
                                <span className="text-sm">있음 (포인트 누적)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="hasGrandFinale" value="WINNERS" />
                                <span className="text-sm">있음 (입상자 선정)</span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {type === 'CUSTOM' ? (
                <div className="card p-8 bg-teal-50 border-teal-200">
                    <h3 className="text-xl font-bold text-teal-800 mb-4">🛠️ 커스텀 모드 개발 안내</h3>
                    <p className="text-teal-700 leading-relaxed mb-6">
                        본 유형은 센터의 요구사항에 맞춰 <strong>별도로 개발되는 특별한 대회 모드</strong>입니다.<br />
                        현재는 기본 구조만 생성되며, 실제 경기 방식 및 규칙은 협의된 방식으로 커스터마이징되어 구현됩니다.
                    </p>
                    <div className="bg-white p-4 rounded-lg border border-teal-100 mb-6">
                        <p className="text-sm font-bold text-slate-500 mb-1">개발 및 커스터마이징 문의</p>
                        <a href="mailto:bronzemusic0828@gmail.com" className="text-lg font-black text-teal-600 hover:text-teal-800 hover:underline">
                            bronzemusic0828@gmail.com
                        </a>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="label">대회 명칭 (관리용)</label>
                            <input name="name" type="text" className="input" placeholder="예: 2024 연말 특별전" required />
                        </div>
                        {/* Hidden Dates for Custom Mode */}
                        <input type="hidden" name="startDate" value={new Date().toISOString().split('T')[0]} />
                        <input type="hidden" name="endDate" value={new Date().toISOString().split('T')[0]} />
                    </div>
                </div>
            ) : (
                <>
                    {type === 'EVENT' ? (
                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            {/* Game Mode moved to top as requested */}
                            <div>
                                <label className="label">대회 진행 설정 (모드)</label>
                                <select name="gameMode" className="input">
                                    <option value="INDIVIDUAL">개인전</option>
                                    <option value="TEAM_2">2인조 전</option>
                                    <option value="TEAM_3">3인조 전</option>
                                    <option value="TEAM_4">4인조 전</option>
                                    <option value="TEAM_5">5인조 전</option>
                                    <option value="TEAM_6">6인조 전</option>
                                </select>
                            </div>

                            <div>
                                <label className="label">대회 명칭</label>
                                <input name="name" type="text" className="input" placeholder="예: 2024 개관 기념 이벤트전" required />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">대회일시 (시작)</label>
                                    <input name="startDate" type="datetime-local" className="input" required />
                                </div>
                                {/* Hidden Field for End Date (Required by backend validation) */}
                                <input type="hidden" name="endDate" value="2099-12-31" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">접수 시작 일시</label>
                                    <input name="registrationStart" type="datetime-local" className="input" required />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">경기 방식 (게임 수)</label>
                                    <select name="gameCount" className="input" defaultValue={3}>
                                        {[1, 2, 3, 4, 5].map(n => (
                                            <option key={n} value={n}>{n}게임</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="label">참가 인원 (최대 정원)</label>
                                    <input name="maxParticipants" type="number" className="input" placeholder="예: 48" min="1" required />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">참가 대상</label>
                                    <input name="target" type="text" className="input" placeholder="예: 누구나 참여 가능" />
                                </div>
                                <div>
                                    <label className="label">참가비</label>
                                    <input name="entryFeeText" type="text" className="input" placeholder="예: 20,000원" />
                                </div>
                            </div>

                            <div>
                                <label className="label">입금계좌</label>
                                <input name="bankAccount" type="text" className="input" placeholder="예: 국민은행 123-456-7890 (홍길동)" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="label">핸디 적용 안내</label>
                                    <input name="handicapInfo" type="text" className="input" placeholder="예: 센터 핸디 적용" />
                                </div>
                                <div>
                                    <label className="label">대회 패턴</label>
                                    <input name="pattern" type="text" className="input" placeholder="예: 하우스 패턴" />
                                </div>
                            </div>

                            <div>
                                <label className="label">대회 상세 설명</label>
                                <textarea name="description" className="input min-h-[150px] p-4" placeholder="대회 규칙 및 공지사항을 입력하세요." />
                            </div>
                        </div>
                    ) : (
                        type !== 'LEAGUE' && type !== 'CHAMP' && (
                            <div>
                                <label className="label">최대 참가 인원</label>
                                <input name="maxParticipants" type="number" className="input" placeholder="예: 48" defaultValue={48} min="1" required />
                            </div>
                        )
                    )}

                    {!['CUSTOM', 'EVENT'].includes(type) && (
                        <div>
                            <label className="label">대회 상세 설명</label>
                            <textarea name="description" className="input min-h-[150px] p-4" placeholder="기타 대회 공지사항 등을 입력하세요." />
                        </div>
                    )}
                </>
            )
            }

            <div className="flex gap-4 mt-4">
                <Link href={`/centers/${centerId}`} className="btn btn-secondary flex-1 flex items-center justify-center">취소</Link>
                <button type="submit" className="btn btn-primary flex-1">대회 생성하기</button>
            </div>
        </form >
    );
}
