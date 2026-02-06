'use server';

export async function ping(email: string) {
    console.log("PING received for:", email);
    return { success: true, message: "PING 성공! 서버가 살아있습니다. (Email: " + email + ")" };
}
