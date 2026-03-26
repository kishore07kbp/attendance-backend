const SibApiV3Sdk = require('sib-api-v3-sdk');

// Configure once
const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

const sendEmail = async (options) => {
  try {
    // 🔍 Debug: Check ENV
    console.log("🔑 BREVO_API_KEY:", process.env.BREVO_API_KEY ? "Loaded ✅" : "Missing ❌");
    console.log("📧 EMAIL_FROM:", process.env.EMAIL_FROM);

    console.log("📨 Sending email to:", options.email);
    console.log("📌 Subject:", options.subject);

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.subject = options.subject;
    sendSmtpEmail.htmlContent =
      options.html || `<p>${options.message}</p>`;

    sendSmtpEmail.sender = {
      name: "Smart Attendance",
      email: process.env.EMAIL_FROM
    };

    sendSmtpEmail.to = [{ email: options.email }];

    if (options.message) {
      sendSmtpEmail.textContent = options.message;
    }

    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);

    // ✅ Success log
    console.log("✅ Email sent successfully to:", options.email);

    return data;

  } catch (error) {
    // ❌ Error logs
    console.error("❌ Brevo Email Error:");
    console.error("Message:", error.message);

    if (error.response?.body) {
      console.error("Response:", JSON.stringify(error.response.body, null, 2));
    }

    throw error;
  }
};

module.exports = sendEmail;