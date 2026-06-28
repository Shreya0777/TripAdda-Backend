const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // 587 ke liye false
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  family: 4, // Force IPv4
});

const sendEmail = async ({ to, subject, text }) => {
  const info = await transporter.sendMail({
    from: `"TripAdda" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
  });

  console.log("Email sent:", info.messageId);
};

module.exports = sendEmail;