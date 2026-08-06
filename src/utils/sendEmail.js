const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, text }) => {
  const { data, error } = await resend.emails.send({
    from: "TripAdda <otp@tripadda.com>", // verified domain
    to,
    subject,
    text,
  });

  if (error) {
    console.error("Resend Error:", error);
    throw new Error(error.message);
  }

  console.log("Email sent:", data);
};

module.exports = sendEmail;