
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
        subject: '[BowlingManager] 회원가입 인증 코드',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>이메일 인증</h2>
                <p>안녕하세요,</p>
                <p>BowlingManager 가입을 위해 아래 인증 코드를 입력해주세요.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="background-color: #f3f4f6; color: #1f2937; padding: 12px 24px; font-size: 24px; font-weight: bold; letter-spacing: 4px; border-radius: 5px;">
                        ${token}
                    </span>
                </div>
                <p>이 코드는 10분 동안 유효합니다.</p>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
}

export async function sendPasswordResetEmail(email: string, token: string) {
    const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: '[BowlingManager] 비밀번호 재설정 인증 코드',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>비밀번호 재설정</h2>
                <p>안녕하세요,</p>
                <p>비밀번호 재설정을 위해 아래 인증 코드를 입력해주세요.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="background-color: #f3f4f6; color: #1f2937; padding: 12px 24px; font-size: 24px; font-weight: bold; letter-spacing: 4px; border-radius: 5px;">
                        ${token}
                    </span>
                </div>
                <p>이 코드는 10분 동안 유효합니다.</p>
                <p>본인이 요청하지 않았다면 이 메일을 무시하세요.</p>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
}
