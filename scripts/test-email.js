const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

async function testEmail() {
    console.log('--- Email Test Script (Robust) ---');

    // Manually parse .env if it exists
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
                process.env[key.trim()] = value;
            }
        });
    }

    console.log('GMAIL_USER:', process.env.GMAIL_USER);
    console.log('GMAIL_APP_PASSWORD set:', !!process.env.GMAIL_APP_PASSWORD);

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });

    const mailOptions = {
        from: process.env.GMAIL_USER,
        to: process.env.GMAIL_USER, // Send to self
        subject: '[Test] 볼링 매니저 이메일 발송 테스트',
        text: '이 메일이 도착하면 서버의 이메일 발송 기능이 정상입니다.'
    };

    try {
        console.log('Sending test email...');
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
    } catch (error) {
        console.error('❌ Email sending failed:', error.message);
        if (error.code === 'EAUTH') {
            console.error('인증 오류: 이메일 주소나 앱 비밀번호를 확인해주세요.');
        }
    }
}

testEmail();
