
// import nodemailer from 'nodemailer';

/* const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
}); */

export async function sendVerificationEmail(email: string, token: string) {
    console.log("MOCK: Email would be sent to", email);
}

export async function sendPasswordResetEmail(email: string, token: string) {
    console.log("MOCK: Reset Email would be sent to", email);
}
