const nodeMailer = require('nodemailer');

const sendEmail = async (to, subject, text, html) => {
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFromEmail = process.env.RESEND_FROM_EMAIL;

    if (resendApiKey || resendFromEmail) {
        if (!resendApiKey || !resendFromEmail) {
            console.error('Resend delivery requires both RESEND_API_KEY and RESEND_FROM_EMAIL');
            return false;
        }

        try {
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${resendApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: resendFromEmail,
                    to: [to],
                    subject,
                    text,
                    ...(html ? { html } : {}),
                }),
            });

            if (!response.ok) {
                let providerError;
                try {
                    providerError = await response.json();
                } catch {
                    providerError = null;
                }
                console.error(
                    'Resend delivery failed:',
                    response.status,
                    providerError?.message || providerError?.name || 'Provider rejected the email',
                );
                return false;
            }

            return true;
        } catch (error) {
            console.error('Resend delivery failed:', error.message || 'Unable to reach Resend');
            return false;
        }
    }

    // Keep Gmail as an optional fallback for local development.
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('Email delivery skipped: configure Resend or Gmail in backend/.env');
        return false;
    }

    try {
        const transporter = nodeMailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            }
        });
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject,
            text,
            ...(html ? { html } : {}),
        }
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending email:', error.message || 'Email provider rejected the request');
        return false;
    }
}

module.exports = sendEmail;