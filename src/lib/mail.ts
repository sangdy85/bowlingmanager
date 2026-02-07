import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

export async function sendVerificationEmail(email: string, token: string) {
    const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: '[볼링 점수 관리] 이메일 인증 코드',
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2>이메일 인증을 완료해주세요</h2>
                <p>아래의 인증 코드를 회원가입 화면에 입력해주세요:</p>
                <div style="font-size: 24px; font-weight: bold; padding: 10px; background: #f4f4f4; border-radius: 5px; display: inline-block;">
                    ${token}
                </div>
                <p>이 코드는 10분 동안 유효합니다.</p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
}

export async function sendPasswordResetEmail(email: string, token: string) {
    const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: '[볼링 점수 관리] 비밀번호 재설정 코드',
        html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2>비밀번호를 재설정합니다</h2>
                <p>아래의 확인 코드를 입력하여 비밀번호 재설정을 완료해주세요:</p>
                <div style="font-size: 24px; font-weight: bold; padding: 10px; background: #f4f4f4; border-radius: 5px; display: inline-block;">
                    ${token}
                </div>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
}
