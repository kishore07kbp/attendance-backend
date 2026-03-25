const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1. Create a transporter
  // Note: For production, use real service like Gmail, SendGrid, Mailtrap etc.
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  // 2. Define the email options
  const mailOptions = {
    from: `Smart Attendance <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html
  };

  // 3. Actually send the email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
