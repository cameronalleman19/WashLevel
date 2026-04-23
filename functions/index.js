const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
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

// Send daily summary email
exports.sendDailySummary = onCall({ secrets: ["RESEND_API_KEY"] }, async (request) => {
  const { uid, test } = request.data;
  if (!uid) throw new Error("No uid provided");

  const resend = new Resend(RESEND_API_KEY.value());

  // Get user data
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) throw new Error("User not found");
  const userData = userSnap.data();

  // Get alert prefs
  const prefsSnap = await db.collection("users").doc(uid).collection("prefs").doc("alerts").get();
  const prefs = prefsSnap.exists ? prefsSnap.data() : {};
  if (!test && !prefs.dailySummaryEnabled) return { skipped: true };

  const email = userData.email;
  const isManager = userData.role === "manager";
  const ownerId = userData.isTeamMember ? userData.ownerId : uid;

  // Get locations
  const locsSnap = await db.collection("locations").where("ownerId", "==", ownerId).get();
  const locations = locsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Filter to allowed locations for team members
  const allowedLocs = userData.isTeamMember
    ? locations.filter(l => (userData.allowedLocations || []).includes(l.id))
    : locations;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split("T")[0];

  let html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1a3352; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">WashLevel Daily Summary</h1>
        <p style="color: #94a3b8; margin: 6px 0 0;">${yesterday.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
      </div>
      <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
  `;

  let totalCars = 0;
  let totalDone = 0;
  let totalOpen = 0;
  let totalOverdue = 0;

  for (const loc of allowedLocs) {
    html += `<h2 style="color: #1a3352; font-size: 16px; margin: 16px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px;">${loc.name}</h2>`;

    // Car counts (managers only)
    if (isManager && prefs.includeCounts !== false) {
      const countSnap = await db.collection("locations").doc(loc.id).collection("daySummaries").doc(dateStr).get();
      const cars = countSnap.exists ? (countSnap.data().carsWashed || 0) : 0;
      totalCars += cars;
      html += `<p style="margin: 4px 0; color: #374151;"><strong>Cars Washed:</strong> ${cars}</p>`;
    }

    // Tasks
    const tasksSnap = await db.collection("locations").doc(loc.id).collection("tasks").get();
    const tasks = tasksSnap.docs.map(d => d.data());
    const today = new Date().toISOString().split("T")[0];

    const done = tasks.filter(t => t.status === "done" && t.completedAt?.startsWith(dateStr));
    const open = tasks.filter(t => t.status !== "done" && !t.archived);
    const overdue = open.filter(t => t.due && t.due < today);

    totalDone += done.length;
    totalOpen += open.length;
    totalOverdue += overdue.length;

    if (prefs.includeTasksDone !== false && done.length > 0)
      html += `<p style="margin: 4px 0; color: #374151;"><strong>Tasks Completed:</strong> ${done.length}</p>`;
    if (prefs.includeOpenTasks !== false && open.length > 0)
      html += `<p style="margin: 4px 0; color: #374151;"><strong>Open Tasks:</strong> ${open.length}</p>`;
    if (prefs.includeOverdue !== false && overdue.length > 0)
      html += `<p style="margin: 4px 0; color: #e74c3c;"><strong>Overdue Tasks:</strong> ${overdue.length}</p>`;

    // Equipment alerts (managers only)
    if (isManager && prefs.includeEquipment !== false) {
      const eqSnap = await db.collection("locations").doc(loc.id).collection("equipment").where("status", "!=", "ok").get();
      if (!eqSnap.empty) {
        html += `<p style="margin: 4px 0; color: #e74c3c;"><strong>Equipment Alerts:</strong> ${eqSnap.docs.map(d => d.data().name).join(", ")}</p>`;
      }
    }
  }

  // Totals for managers
  if (isManager && allowedLocs.length > 1) {
    html += `
      <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 20px;">
        <h3 style="margin: 0 0 10px; color: #1a3352;">All Locations Total</h3>
        ${prefs.includeCounts !== false ? `<p style="margin: 4px 0;"><strong>Total Cars:</strong> ${totalCars}</p>` : ""}
        <p style="margin: 4px 0;"><strong>Tasks Done:</strong> ${totalDone} | <strong>Open:</strong> ${totalOpen} | <strong style="color: #e74c3c;">Overdue:</strong> ${totalOverdue}</p>
      </div>
    `;
  }

  html += `
      <p style="margin-top: 24px; font-size: 12px; color: #9ca3af; text-align: center;">
        WashLevel.com — Manage your alert preferences in the app
      </p>
      </div>
    </div>
  `;

  await resend.emails.send({
    from: "WashLevel <noreply@washlevel.com>",
    to: email,
    subject: `WashLevel Daily Summary — ${yesterday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    html
  });

  return { sent: true, to: email };
});



// Scheduled daily summary - runs every hour
exports.scheduledDailySummary = onSchedule({ schedule: "0 * * * *", timeZone: "America/New_York", secrets: ["RESEND_API_KEY"] }, async () => {
  const now = new Date();
  // Get Eastern time hour
  const etHour = parseInt(now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }));
  const hourStr = String(etHour).padStart(2, "0") + ":00";

  // Get all users with daily summary enabled
  const usersSnap = await db.collection("users").get();

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    if (!userData.email) continue;

    // Get alert prefs
    const prefsSnap = await db.collection("users").doc(userDoc.id).collection("prefs").doc("alerts").get();
    if (!prefsSnap.exists) continue;
    const prefs = prefsSnap.data();
    if (!prefs.dailySummaryEnabled) continue;

    // Check if this is the right hour to send
    const sendTime = prefs.dailySummaryTime || "07:00";
    const sendHour = sendTime.split(":")[0].padStart(2, "0") + ":00";
    if (sendHour !== hourStr) continue;

    // Send the summary using the same logic as sendDailySummary
    try {
      const isManager = userData.role === "manager";
      const ownerId = userData.isTeamMember ? userData.ownerId : userDoc.id;
      const email = prefs.summaryEmail || userData.email;

      const locsSnap = await db.collection("locations").where("ownerId", "==", ownerId).get();
      const locations = locsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const allowedLocs = userData.isTeamMember
        ? locations.filter(l => (userData.allowedLocations || []).includes(l.id))
        : locations;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split("T")[0];

      const resend = new Resend(RESEND_API_KEY.value());

      let html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1a3352; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">WashLevel Daily Summary</h1>
          <p style="color: #94a3b8; margin: 6px 0 0;">${yesterday.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>
        <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">`;

      let totalCars = 0;
      let totalDone = 0;
      let totalOpen = 0;
      let totalOverdue = 0;
      const today = new Date().toISOString().split("T")[0];

      for (const loc of allowedLocs) {
        html += `<h2 style="color: #1a3352; font-size: 16px; margin: 16px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px;">${loc.name}</h2>`;

        if (isManager && prefs.includeCounts !== false) {
          const countSnap = await db.collection("locations").doc(loc.id).collection("daySummaries").doc(dateStr).get();
          const cars = countSnap.exists ? (countSnap.data().carsWashed || 0) : 0;
          totalCars += cars;
          html += `<p style="margin: 4px 0; color: #374151;"><strong>Cars Washed:</strong> ${cars}</p>`;
        }

        const tasksSnap = await db.collection("locations").doc(loc.id).collection("tasks").get();
        const tasks = tasksSnap.docs.map(d => d.data());
        const done = tasks.filter(t => t.status === "done" && t.completedAt?.startsWith(dateStr));
        const open = tasks.filter(t => t.status !== "done" && !t.archived);
        const overdue = open.filter(t => t.due && t.due < today);

        totalDone += done.length;
        totalOpen += open.length;
        totalOverdue += overdue.length;

        if (prefs.includeTasksDone !== false && done.length > 0)
          html += `<p style="margin: 4px 0; color: #374151;"><strong>Tasks Completed:</strong> ${done.length}</p>`;
        if (prefs.includeOpenTasks !== false && open.length > 0)
          html += `<p style="margin: 4px 0; color: #374151;"><strong>Open Tasks:</strong> ${open.length}</p>`;
        if (prefs.includeOverdue !== false && overdue.length > 0)
          html += `<p style="margin: 4px 0; color: #e74c3c;"><strong>Overdue Tasks:</strong> ${overdue.length}</p>`;

        if (isManager && prefs.includeEquipment !== false) {
          const eqSnap = await db.collection("locations").doc(loc.id).collection("equipment").where("status", "!=", "ok").get();
          if (!eqSnap.empty)
            html += `<p style="margin: 4px 0; color: #e74c3c;"><strong>Equipment Alerts:</strong> ${eqSnap.docs.map(d => d.data().name).join(", ")}</p>`;
        }
      }

      if (isManager && allowedLocs.length > 1) {
        html += `<div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 20px;">
          <h3 style="margin: 0 0 10px; color: #1a3352;">All Locations Total</h3>
          ${prefs.includeCounts !== false ? `<p style="margin: 4px 0;"><strong>Total Cars:</strong> ${totalCars}</p>` : ""}
          <p style="margin: 4px 0;"><strong>Tasks Done:</strong> ${totalDone} | <strong>Open:</strong> ${totalOpen} | <strong style="color: #e74c3c;">Overdue:</strong> ${totalOverdue}</p>
        </div>`;
      }

      html += `<p style="margin-top: 24px; font-size: 12px; color: #9ca3af; text-align: center;">WashLevel.com</p></div></div>`;

      await resend.emails.send({
        from: "WashLevel <noreply@washlevel.com>",
        to: email,
        subject: `WashLevel Daily Summary — ${yesterday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        html
      });

    } catch(e) {
      console.log("Error sending summary to", userDoc.id, e.message);
    }
  }
});



// ChemLevel sensor data ingestion endpoint
exports.ingestSensorReading = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const { sensorId, locationId, value, unit, secret } = req.body;

  // Basic auth check
  if (secret !== "chemlevel2025") return res.status(401).send("Unauthorized");
  if (!sensorId || !locationId || value === undefined) return res.status(400).send("Missing fields");

  const timestamp = new Date().toISOString();
  const reading = { sensorId, locationId, value: parseFloat(value), unit: unit || "PSI", timestamp };

  // Write latest reading
  await db.collection("locations").doc(locationId)
    .collection("sensorReadings").doc(sensorId)
    .set({ ...reading, updatedAt: timestamp });

  // Write to history
  await db.collection("locations").doc(locationId)
    .collection("sensorReadings").doc(sensorId)
    .collection("history").add(reading);

  // Check Shelly BLU distance threshold alerts
  try {
    const shellySnap = await db.collection("locations").doc(locationId)
      .collection("shellyDevices").where("type", "==", "blu_distance").get();

    for (const deviceDoc of shellySnap.docs) {
      const device = deviceDoc.data();
      if (device.sensorId !== sensorId) continue;
      const distInches = parseFloat((parseFloat(value) / 25.4).toFixed(1));
      const minAlert = device.minAlert || 2;
      if (distInches < minAlert) {
        // Get all users for this location
        const locDoc = await db.collection("locations").doc(locationId).get();
        const ownerId = locDoc.data()?.ownerId;
        if (!ownerId) continue;
        const usersSnap = await db.collection("users")
          .where("ownerId", "==", ownerId).get();
        const ownerSnap = await db.collection("users").doc(ownerId).get();
        const allUsers = [...usersSnap.docs, ownerSnap];
        for (const userDoc of allUsers) {
          if (!userDoc.exists) continue;
          const notifId = "notif" + Date.now() + userDoc.id;
          await db.collection("users").doc(userDoc.id)
            .collection("notifications").doc(notifId).set({
              id: notifId,
              type: "sensor_alert",
              title: "⚠️ Sensor Alert: " + device.name,
              body: device.name + " reading is " + distInches + '" — below threshold of ' + minAlert + '"',
              locationId,
              createdAt: new Date().toISOString(),
              read: false,
            });
        }
      }
    }
  } catch(e) {
    console.log("Alert check error:", e.message);
  }

  res.status(200).json({ ok: true, timestamp });
});


// ChemLevel sensor data ingestion endpoint
exports.ingestSensorReading = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const { sensorId, locationId, value, unit, secret } = req.body;

  // Basic auth check
  if (secret !== "chemlevel2025") return res.status(401).send("Unauthorized");
  if (!sensorId || !locationId || value === undefined) return res.status(400).send("Missing fields");

  const timestamp = new Date().toISOString();
  const reading = { sensorId, locationId, value: parseFloat(value), unit: unit || "PSI", timestamp };

  // Write latest reading
  await db.collection("locations").doc(locationId)
    .collection("sensorReadings").doc(sensorId)
    .set({ ...reading, updatedAt: timestamp });

  // Write to history
  await db.collection("locations").doc(locationId)
    .collection("sensorReadings").doc(sensorId)
    .collection("history").add(reading);

  // Check Shelly BLU distance threshold alerts
  try {
    const shellySnap = await db.collection("locations").doc(locationId)
      .collection("shellyDevices").where("type", "==", "blu_distance").get();

    for (const deviceDoc of shellySnap.docs) {
      const device = deviceDoc.data();
      if (device.sensorId !== sensorId) continue;
      const distInches = parseFloat((parseFloat(value) / 25.4).toFixed(1));
      const minAlert = device.minAlert || 2;
      if (distInches < minAlert) {
        // Get all users for this location
        const locDoc = await db.collection("locations").doc(locationId).get();
        const ownerId = locDoc.data()?.ownerId;
        if (!ownerId) continue;
        const usersSnap = await db.collection("users")
          .where("ownerId", "==", ownerId).get();
        const ownerSnap = await db.collection("users").doc(ownerId).get();
        const allUsers = [...usersSnap.docs, ownerSnap];
        for (const userDoc of allUsers) {
          if (!userDoc.exists) continue;
          const notifId = "notif" + Date.now() + userDoc.id;
          await db.collection("users").doc(userDoc.id)
            .collection("notifications").doc(notifId).set({
              id: notifId,
              type: "sensor_alert",
              title: "⚠️ Sensor Alert: " + device.name,
              body: device.name + " reading is " + distInches + '" — below threshold of ' + minAlert + '"',
              locationId,
              createdAt: new Date().toISOString(),
              read: false,
            });
        }
      }
    }
  } catch(e) {
    console.log("Alert check error:", e.message);
  }

  res.status(200).json({ ok: true, timestamp });
});


// Check SensorPush thresholds for all users
exports.checkSensorPushAlerts = onSchedule({ schedule: "*/10 * * * *", timeZone: "America/New_York", secrets: ["RESEND_API_KEY"] }, async () => {
  console.log("checkSensorPushAlerts running at", new Date().toISOString());
  const usersSnap = await db.collection("users").get();
  console.log("Found", usersSnap.docs.length, "users");
  
  for (const userDoc of usersSnap.docs) {
    try {
      const prefsSnap = await db.collection("users").doc(userDoc.id).collection("prefs").doc("alerts").get();
      if (!prefsSnap.exists || !prefsSnap.data().sensorPushAlert) continue;
      console.log("Checking SensorPush for user", userDoc.id);

      const alertPrefsSnap = await db.collection("users").doc(userDoc.id).collection("prefs").doc("sensorAlerts").get();
      if (!alertPrefsSnap.exists) { console.log("No sensorAlerts prefs for", userDoc.id); continue; }
      const alertPrefs = alertPrefsSnap.data();
      console.log("Alert prefs:", JSON.stringify(alertPrefs));

      const spSnap = await db.collection("users").doc(userDoc.id).collection("integrations").doc("sensorpush").get();
      if (!spSnap.exists || spSnap.data().disconnected) { console.log("No SensorPush integration"); continue; }
      const { accessToken, sensors, assignments } = spSnap.data();
      if (!accessToken) { console.log("No accessToken"); continue; }
      // sensors could be array or object
      const sensorIds = Array.isArray(sensors) 
        ? sensors.map(s => s.id || s).filter(Boolean)
        : sensors ? Object.keys(sensors) : [];
      // also try assignments
      const allIds = sensorIds.length > 0 ? sensorIds : (assignments ? Object.values(assignments) : []);
      console.log("Sensor IDs:", allIds);
      console.log("Sensors structure:", JSON.stringify(sensors).substring(0, 300));
      if (!allIds.length) { console.log("No sensor IDs found"); continue; }

      const sampleRes = await fetch("https://api.sensorpush.com/api/v1/samples", {
        method: "POST",
        headers: { "Authorization": accessToken, "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 1, sensors: allIds })
      });
      const sampleData = await sampleRes.json();
      console.log("SensorPush response:", JSON.stringify(sampleData).substring(0, 200));
      if (!sampleData.sensors) continue;

      for (const [sensorId, readings] of Object.entries(sampleData.sensors)) {
        if (!readings || readings.length === 0) continue;
        const latest = readings[0];
        const tempF = latest.temperature ? Math.round(latest.temperature * 9/5 + 32) : null;
        const humidity = latest.humidity ? Math.round(latest.humidity) : null;
        const thresholds = alertPrefs[sensorId];
        console.log("Sensor", sensorId, "tempF:", tempF, "humidity:", humidity, "thresholds:", JSON.stringify(thresholds));
        if (!thresholds) continue;
        // sensors could be array or object with name
        let sensorName = sensorId;
        if (Array.isArray(sensors)) {
          const found = sensors.find(s => s.id === sensorId);
          sensorName = found?.name || sensorId;
        } else if (sensors[sensorId]) {
          sensorName = sensors[sensorId]?.name || sensorId;
        }
        console.log("Sensor name for", sensorId, ":", sensorName);

        const alerts = [];
        if (tempF !== null && thresholds.minTemp !== undefined && tempF < Number(thresholds.minTemp))
          alerts.push("Temperature " + tempF + "°F is below minimum " + thresholds.minTemp + "°F");
        if (tempF !== null && thresholds.maxTemp !== undefined && tempF > Number(thresholds.maxTemp))
          alerts.push("Temperature " + tempF + "°F is above maximum " + thresholds.maxTemp + "°F");
        if (humidity !== null && thresholds.minHumidity !== undefined && humidity < Number(thresholds.minHumidity))
          alerts.push("Humidity " + humidity + "% is below minimum " + thresholds.minHumidity + "%");
        if (humidity !== null && thresholds.maxHumidity !== undefined && humidity > Number(thresholds.maxHumidity))
          alerts.push("Humidity " + humidity + "% is above maximum " + thresholds.maxHumidity + "%");

        console.log("Alerts for", sensorId, ":", alerts);

        for (const alertMsg of alerts) {
          const nid = "notif" + Date.now() + sensorId;
          await db.collection("users").doc(userDoc.id).collection("notifications").doc(nid).set({
            id: nid, type: "sensor_alert", sensorId,
            title: "⚠️ SensorPush Alert: " + sensorName,
            body: alertMsg,
            view: "sensors",
            createdAt: new Date().toISOString(), read: false,
          });
          console.log("Notification sent for", sensorId, ":", alertMsg);
        }
      }
    } catch(e) {
      console.log("Error for user", userDoc.id, ":", e.message);
    }
  }
});



// Shelly Cloud proxy
exports.shellyCloudProxy = onCall({ timeoutSeconds: 30 }, async (request) => {
  console.log("shellyCloudProxy called with data:", JSON.stringify(request.data).slice(0,100));
  console.log("Auth:", request.auth?.uid || "none");
  const { authKey, server, deviceId } = request.data;
  if (!authKey || !server) throw new Error("Missing credentials");

  const cleanServer = server.replace("https://", "").replace(/\/$/, "");
  
  try {
    // If deviceId provided, get specific device status
    if (deviceId) {
      const url = `https://${cleanServer}/device/status`;
      console.log("Getting device status:", url, "device:", deviceId);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `auth_key=${encodeURIComponent(authKey)}&id=${encodeURIComponent(deviceId)}`
      });
      const data = await res.json();
      console.log("Device status response:", JSON.stringify(data).slice(0, 300));
      return data;
    }
    
    // Try multiple possible list endpoints
    const listEndpoints = [
      "/interface/account/getdeviceslist",
      "/api/shelly/device/list", 
      "/account/getdeviceslist",
      "/interface/device/list",
    ];
    
    for (const ep of listEndpoints) {
      const url = `https://${cleanServer}${ep}`;
      console.log("Trying endpoint:", url);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `auth_key=${encodeURIComponent(authKey)}`,
          signal: controller.signal
        });
        clearTimeout(timeout);
        const data = await res.json();
        console.log("Response from", ep, ":", JSON.stringify(data).slice(0, 200));
        if (data.isok) return data;
      } catch(fetchErr) {
        clearTimeout(timeout);
        console.log("Fetch error for", ep, ":", fetchErr.message);
      }
    }
    
    // Last resort - verify key is valid with device/status
    const verifyUrl = `https://${cleanServer}/device/status`;
    const vRes = await fetch(verifyUrl, {
      method: "POST", 
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `auth_key=${encodeURIComponent(authKey)}&id=verify`
    });
    const vData = await vRes.json();
    console.log("Verify response:", JSON.stringify(vData).slice(0, 200));
    // If we get wrong_device_id error, key is valid
    if (vData.errors?.wrong_device_id) return { isok: true, verified: true, devices: [] };
    return vData;
  } catch(e) {
    console.log("Shelly fetch error:", e.message);
    throw new Error("Could not connect to Shelly Cloud: " + e.message);
  }
});


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
    console.log("Full email object:", JSON.stringify(emailFull).slice(0, 2000));
    const toFull = toAddress;
    const body = emailFull?.text || emailFull?.html || "";
    
    // Extract location code from wash4821@washlevel.com
    const match = toFull.match(/([a-z]+\d+)@washlevel\.com/i);
    if (!match) { console.log("No location code in:", toFull); res.status(200).send("No location code"); return; }
    const locationCode = match[1].toLowerCase();
    console.log("Location code:", locationCode);
    
    // Parse car count - supports multiple equipment email formats
    let count = null;

    // Format 1: TOTAL = 16148: TODAY = 6 (Dencar)
    const todayMatch = body.match(/TODAY\s*=\s*(\d+)/i);
    if (todayMatch) { count = parseInt(todayMatch[1]); }

    // Format 2: Today's Total    2 (Accutrac)
    if (count === null) {
      const todaysTotalMatch = body.match(/Today'?s\s*Total\s+(\d+)/i);
      if (todaysTotalMatch) count = parseInt(todaysTotalMatch[1]);
    }

    // Format 3: Package rows - sum last column (FreeStyler)
    // Handles "PACKAGE1  15364  9" and "1  15364  9" formats
    if (count === null && /PACKAGE RUNNING TODAY/i.test(body)) {
      const rows = body.match(/^\s*(?:PACKAGE)?\d+\s+\d+\s+(\d+)\s*$/gim);
      if (rows && rows.length > 0) {
        count = rows.reduce((sum, row) => {
          const parts = row.trim().split(/\s+/);
          return sum + (parseInt(parts[parts.length - 1]) || 0);
        }, 0);
      }
    }

    // Format 4: TOTAL = 16 fallback
    if (count === null) {
      const totalMatch = body.match(/TOTAL\s*=\s*(\d+)/i);
      if (totalMatch) count = parseInt(totalMatch[1]);
    }

    // Format 5: Total Washes: 6
    if (count === null) {
      const washMatch = body.match(/total\s*washes?\s*[:\-=]?\s*(\d+)/i);
      if (washMatch) count = parseInt(washMatch[1]);
    }
    if (count === null) { console.log("No count in body:", body.slice(0,200)); res.status(200).send("No count found"); return; }
    
    // Use yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];
    
    // Find location by emailCode
    const locsSnap = await db.collection("locations").where("emailCode", "==", locationCode).get();
    if (locsSnap.empty) { console.log("No location for code:", locationCode); res.status(200).send("Location not found"); return; }
    
    const locId = locsSnap.docs[0].id;
    const summaryRef = db.collection("locations").doc(locId).collection("daySummaries").doc(dateStr);
    const existing = await summaryRef.get();
    const existingCount = existing.exists ? (existing.data().carsWashed || 0) : 0;
    const newCount = existingCount + count;
    await summaryRef.set({
      carsWashed: newCount, date: dateStr, source: "email", updatedAt: new Date().toISOString()
    }, { merge: true });
    
    console.log("Saved", count, "cars for location", locId, "on", dateStr);
    res.status(200).send("OK");
  } catch(e) {
    console.error("Error:", e.message);
    res.status(500).send("Error: " + e.message);
  }
});// updated Fri Apr  3 01:06:00 UTC 2026
