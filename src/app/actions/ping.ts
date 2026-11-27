'use server';

export async function ping(email: string) {
    void email;
    return { success: true, message: "PING 성공! 서버가 살아있습니다." };
}
