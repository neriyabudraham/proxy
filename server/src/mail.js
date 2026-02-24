import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: 'איפוס סיסמה - מערכת ניהול פרוקסי',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>איפוס סיסמה</h2>
        <p>לחץ על הקישור הבא לאיפוס הסיסמה:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">איפוס סיסמה</a>
        <p>הקישור תקף ל-24 שעות.</p>
      </div>
    `
  });
}

export async function sendNewUserEmail(email, tempPassword) {
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: 'הוזמנת למערכת ניהול פרוקסי',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>ברוך הבא!</h2>
        <p>נפתח עבורך חשבון במערכת.</p>
        <p><strong>אימייל:</strong> ${email}</p>
        <p><strong>סיסמה זמנית:</strong> ${tempPassword}</p>
        <a href="${process.env.CLIENT_URL}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">התחבר למערכת</a>
      </div>
    `
  });
}
