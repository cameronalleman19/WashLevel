const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
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

// Custom password reset email via Resend
exports.sendPasswordResetEmail = onCall({ secrets: [RESEND_API_KEY] }, async (request) => {
  const { email } = request.data;
  if (!email) throw new HttpsError("invalid-argument", "Email required");

  const resend = new Resend(RESEND_API_KEY.value());

  try {
    // Generate reset link using Firebase Admin
    const link = await admin.auth().generatePasswordResetLink(email);

    await resend.emails.send({
      from: "WashLevel <noreply@washlevel.com>",
      to: email,
      subject: "Reset your WashLevel password",
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f8fafc;">
          <div style="background: #1a3352; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 700;">WashLevel</h1>
            <p style="color: #94a3b8; margin: 4px 0 0; font-size: 12px; letter-spacing: 2px;">CAR WASH OPERATIONS</p>
          </div>
          <div style="background: #fff; border-radius: 12px; padding: 28px; margin-bottom: 16px;">
            <h2 style="color: #111827; font-size: 20px; margin: 0 0 8px;">Reset your password</h2>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
              We received a request to reset your WashLevel password. Click the button below to choose a new password. This link expires in 1 hour.
            </p>
            <a href="${link}" style="display: block; background: #1a3352; color: #fff; text-decoration: none; text-align: center; padding: 14px; border-radius: 8px; font-weight: 700; font-size: 15px; margin-bottom: 16px;">
              Reset My Password
            </a>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              If you didn't request a password reset, you can safely ignore this email.
            </p>
          </div>
        </div>
      `
    });

    return { success: true };
  } catch(e) {
    throw new HttpsError("internal", e.message);
  }
});

// Receive equipment email and parse car counts
exports.receiveCountEmail = onRequest({ secrets: [RESEND_API_KEY] }, async (req, res) => {
  try {
    if (req.method !== "POST") { res.status(405).send("Method not allowed"); return; }
    
    const payload = req.body;
    console.log("v2-receiveCountEmail Webhook payload:", JSON.stringify(payload).slice(0, 500));
    
    // Resend sends event data under data field
    const emailData = payload.data || payload;
    const emailId = emailData.email_id || emailData.id;
    const toAddress = emailData.to?.[0] || emailData.to || "";
    
    console.log("Email ID:", emailId, "To:", toAddress);
    
    if (!emailId) { res.status(200).send("No email ID"); return; }
    
    // Fetch full email body using Resend receiving API
    const resend = new Resend(RESEND_API_KEY.value());
    const { data: emailFull, error: fetchError } = await resend.emails.receiving.get(emailId);
    if (fetchError) { console.log("Fetch error:", JSON.stringify(fetchError)); res.status(200).send("Fetch error"); return; }
    console.log("Email body:", (emailFull?.text || "").slice(0, 300));
    const toFull = toAddress;
    const body = emailFull?.text || emailFull?.html || "";
    
    // Extract location code from wash4821@washlevel.com
    const match = toFull.match(/([a-z]+\d+)@washlevel\.com/i);
    if (!match) { console.log("No location code in:", toFull); res.status(200).send("No location code"); return; }
    const locationCode = match[1].toLowerCase();
    console.log("Location code:", locationCode);
    
    // Parse car count - supports multiple equipment email formats
    const countMatch = 
      body.match(/TODAY\s*=\s*(\d+)/i) ||           // TOTAL = 16148: TODAY = 6
      body.match(/Today'?s\s*Total\s+(\d+)/i) ||    // Today's Total    2
      body.match(/TOTAL\s*=\s*(\d+)/i) ||            // TOTAL = 16
      body.match(/total\s*washes?\s*[:\-=]?\s*(\d+)/i) || // Total Washes: 6
      body.match(/washes?\s*today\s*[:\-=]?\s*(\d+)/i);   // Washes Today: 6
    const count = countMatch ? parseInt(countMatch[1]) : null;
    if (count === null) { console.log("No count in body:", body.slice(0,200)); res.status(200).send("No count found"); return; }
    
    // Use yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];
    
    // Find location by emailCode
    const locsSnap = await db.collection("locations").where("emailCode", "==", locationCode).get();
    if (locsSnap.empty) { console.log("No location for code:", locationCode); res.status(200).send("Location not found"); return; }
    
    const locId = locsSnap.docs[0].id;
    await db.collection("locations").doc(locId).collection("daySummaries").doc(dateStr).set({
      carsWashed: count, date: dateStr, source: "email", updatedAt: new Date().toISOString()
    }, { merge: true });
    
    console.log("Saved", count, "cars for location", locId, "on", dateStr);
    res.status(200).send("OK");
  } catch(e) {
    console.error("Error:", e.message);
    res.status(500).send("Error: " + e.message);
  }
});// updated Fri Apr  3 01:06:00 UTC 2026
