const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { Resend } = require("resend");

admin.initializeApp();
const db = admin.firestore();
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

exports.sendInviteEmail = onCall({ secrets: [RESEND_API_KEY] }, async (request) => {
  const { inviteEmail, inviteRole, bizName, managerName } = request.data;
  if (!inviteEmail) throw new HttpsError("invalid-argument", "Email required");

  const resend = new Resend(RESEND_API_KEY.value());

  await resend.emails.send({
    from: "WashLevel <noreply@washlevel.com>",
    to: inviteEmail,
    subject: `You've been invited to join ${bizName} on WashLevel`,
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f8fafc;">
        <div style="background: #1a3352; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 700;">WashLevel</h1>
          <p style="color: #94a3b8; margin: 4px 0 0; font-size: 12px; letter-spacing: 2px;">CAR WASH OPERATIONS</p>
        </div>
        <div style="background: #fff; border-radius: 12px; padding: 28px; margin-bottom: 16px;">
          <h2 style="color: #111827; font-size: 20px; margin: 0 0 8px;">You've been invited!</h2>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
            <strong>${managerName || bizName}</strong> has invited you to join <strong>${bizName}</strong> on WashLevel as a <strong>${inviteRole}</strong>.
          </p>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
            Create your account using this email address to get started:
          </p>
          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; text-align: center;">
            <span style="color: #0369a1; font-weight: 600; font-size: 15px;">${inviteEmail}</span>
          </div>
          <a href="https://washlevel.com/?invite=${encodeURIComponent(inviteEmail)}" style="display: block; background: #1a3352; color: #fff; text-decoration: none; text-align: center; padding: 14px; border-radius: 8px; font-weight: 700; font-size: 15px;">
            Create My Account
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
          If you were not expecting this invitation, you can ignore this email.
        </p>
      </div>
    `
  });

  return { success: true };
});

exports.sendWelcomeEmail = onDocumentCreated({ document: "users/{uid}", secrets: [RESEND_API_KEY] }, async (event) => {
  const user = event.data.data();
  if (!user.email || user.isTeamMember) return;

  const resend = new Resend(RESEND_API_KEY.value());

  await resend.emails.send({
    from: "WashLevel <noreply@washlevel.com>",
    to: user.email,
    subject: "Welcome to WashLevel!",
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f8fafc;">
        <div style="background: #1a3352; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 700;">WashLevel</h1>
          <p style="color: #94a3b8; margin: 4px 0 0; font-size: 12px; letter-spacing: 2px;">CAR WASH OPERATIONS</p>
        </div>
        <div style="background: #fff; border-radius: 12px; padding: 28px;">
          <h2 style="color: #111827; font-size: 20px; margin: 0 0 8px;">Welcome!</h2>
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
            Your WashLevel account is ready. Here are a few things to get started:
          </p>
          <a href="https://washlevel.com" style="display: block; background: #1a3352; color: #fff; text-decoration: none; text-align: center; padding: 14px; border-radius: 8px; font-weight: 700; font-size: 15px; margin-top: 24px;">
            Go to My Dashboard
          </a>
        </div>
      </div>
    `
  });
});
