const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
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
          <img src="https://washlevel.com/email-logo-dark.png" alt="WashLevel" width="203" height="24" style="display:block;margin:0 auto;border:0;" />
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
          <a href="https://washlevel.com/?invite=${encodeURIComponent(inviteEmail)}&owner=${encodeURIComponent(request.data.ownerId || "")}&biz=${encodeURIComponent(request.data.bizName || "")}&role=${encodeURIComponent(request.data.inviteRole || "attendant")}" style="display: block; background: #1a3352; color: #fff; text-decoration: none; text-align: center; padding: 14px; border-radius: 8px; font-weight: 700; font-size: 15px;">
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
          <img src="https://washlevel.com/email-logo-dark.png" alt="WashLevel" width="203" height="24" style="display:block;margin:0 auto;border:0;" />
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
            <img src="https://washlevel.com/email-logo-dark.png" alt="WashLevel" width="203" height="24" style="display:block;margin:0 auto;border:0;" />
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

// Zip to lat/lon via zippopotam.us (same source as app calendar)
async function zipToCoords(zip) {
  try {
    const r = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!r.ok) return null;
    const d = await r.json();
    return { lat: parseFloat(d.places[0].latitude), lon: parseFloat(d.places[0].longitude) };
  } catch(e) { return null; }
}

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
  const isManager = (userData.role === "manager" || userData.role === "owner");
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
  const etDate = yesterday.toLocaleString("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
  const [etMonth, etDay, etYear] = etDate.split("/");
  const dateStr = `${etYear}-${etMonth}-${etDay}`;
  const displayDate = `${parseInt(etMonth)}/${parseInt(etDay)}/${etYear}`;

  let html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1a3352; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
        <img src="https://washlevel.com/email-logo-dark.png" alt="WashLevel" width="203" height="24" style="display:block;margin:0 auto;border:0;" />
        <p style="color: #fff; margin: 10px 0 0; font-size: 18px; font-weight: 600;">Daily Summary</p>
        <p style="color: #94a3b8; margin: 6px 0 0;">${displayDate}</p>
      </div>
      <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
  `;

  let totalCars = 0;
  let totalDone = 0;
  let totalOpen = 0;
  let totalOverdue = 0;

  for (const loc of allowedLocs) {
    let weatherHtml = "";
    if (prefs.includeWeather) {
      try {
        let wLat = loc.lat, wLon = loc.lon;
        if ((!wLat || !wLon) && loc.zipCode) {
          const coords = await zipToCoords(loc.zipCode);
          if (coords) { wLat = coords.lat; wLon = coords.lon; }
        }
        if (wLat && wLon) {
          const wRes = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${wLat}&longitude=${wLon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&hourly=weathercode,precipitation&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America%2FNew_York&start_date=${dateStr}&end_date=${dateStr}`);
         const wData = await wRes.json();
         if (wData.daily) {
           const tMax = Math.round(wData.daily.temperature_2m_max[0]);
           const tMin = Math.round(wData.daily.temperature_2m_min[0]);
           const precip = wData.daily.precipitation_sum[0] || 0;
           const wcode = wData.daily.weathercode[0];
           const wDesc = wcode <= 1 ? "Clear" : wcode <= 3 ? "Partly Cloudy" : wcode <= 48 ? "Foggy" : wcode <= 67 ? "Rain" : wcode <= 77 ? "Snow" : wcode <= 82 ? "Showers" : "Stormy";
           const codeToSev = c => c >= 95 ? 7 : c >= 80 ? 6 : c >= 71 ? 5 : c >= 61 ? 4 : c >= 51 ? 3 : c >= 45 ? 2 : c >= 2 ? 1 : 0;
           const codeToWord = c => c >= 95 ? "Storms" : c >= 80 ? "Showers" : c >= 73 ? "Heavy Snow" : c >= 71 ? "Snow" : c >= 63 ? "Heavy Rain" : c >= 61 ? "Rain" : c >= 51 ? "Drizzle" : c >= 45 ? "Fog" : c >= 3 ? "Cloudy" : "Clear";
           let periodDesc = "";
           if (wData.hourly) {
             const hC = wData.hourly.weathercode || [];
             const hP = wData.hourly.precipitation || [];
             const periods = [
               { label: "Overnight", hours: [0,1,2,3,4,5] },
               { label: "Morning", hours: [6,7,8,9,10,11] },
               { label: "Afternoon", hours: [12,13,14,15,16,17] },
               { label: "Evening", hours: [18,19,20,21,22,23] },
             ];
             let bestLabel = "", bestSev = 0, bestWord = "";
             for (const p of periods) {
               const maxC = Math.max(...p.hours.map(h => hC[h] || 0));
               const totP = p.hours.reduce((s,h) => s+(hP[h]||0), 0);
               const sev = codeToSev(maxC) + (totP > 0.05 ? 1 : 0);
               if (sev > bestSev) { bestSev = sev; bestLabel = p.label; bestWord = codeToWord(maxC); }
             }
             if (bestLabel && bestSev > 1) periodDesc = bestLabel + " " + bestWord;
           }
           const wDisplay = periodDesc || wDesc;
           const wLine = '<div style="font-size:12px;font-weight:700;color:#1a3352;">' + wDisplay + '</div><div style="font-size:20px;font-weight:800;color:#1a3352;">' + tMax + '°F</div><div style="font-size:11px;color:#6b7280;">Low ' + tMin + '°F</div>' + (precip > 0 ? '<div style="font-size:11px;color:#3b82f6;">' + precip.toFixed(2) + '"</div>' : '');
           weatherHtml = wLine;
         }
        }
      } catch(e) { console.log("Weather error:", e.message); }
    }

    html += `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4f8;border:2px solid #1a3352;border-radius:10px;margin:12px 0;"><tr><td style="padding:14px;" valign="top"><div style="font-size:16px;font-weight:700;color:#1a3352;border-bottom:1px solid #c7d2e0;padding-bottom:8px;margin-bottom:10px;">${loc.name}</div>`;

    // Car counts (managers only)
    if (isManager && prefs.includeCounts !== false) {
      const countSnap = await db.collection("locations").doc(loc.id).collection("daySummaries").doc(dateStr).get();
      const summaryData = countSnap.exists ? countSnap.data() : {};
      const cars = summaryData.carsWashed || 0;
      totalCars += cars;

      // Check for per-equipment counts
      const eqCountData = summaryData.equipment || {};
      const hasEqCounts = Object.keys(eqCountData).length > 0;

      if (hasEqCounts) {
        const eqSnap = await db.collection("locations").doc(loc.id).collection("equipment")
          .where("tracksCarCount", "==", true).get();
        const eqMap = {};
        eqSnap.docs.forEach(d => { eqMap[d.id] = d.data().name || d.id; });

        html += `<p style="margin: 4px 0; color: #374151;"><strong>Cars Washed:</strong> ${cars} total</p>`;
        html += `<div style="margin: 4px 0 8px 16px;">`;
        for (const [eqId, eqData] of Object.entries(eqCountData)) {
          const eqName = eqMap[eqId] || eqId;
          html += `<p style="margin: 2px 0; color: #6b7280; font-size: 13px;">${eqName}: <strong>${eqData.carsWashed || 0}</strong></p>`;
        }
        html += `</div>`;
      } else {
        html += `<p style="margin: 4px 0; color: #374151;"><strong>Cars Washed:</strong> ${cars}</p>`;
      }
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

    if (prefs.includeTasksDone !== false && done.length > 0) {
      html += `<p style="margin: 4px 0; color: #374151;"><strong>Tasks Completed:</strong> ${done.length}</p>`;
      if (prefs.includeTaskNames !== false) {
        html += `<ul style="margin: 2px 0 8px 16px; padding: 0; list-style: none;">`;
        done.forEach(t => {
          html += `<li style="margin: 2px 0; color: #059669; font-size: 13px;">${t.title}</li>`;
        });
        html += `</ul>`;
      }
    }
    if (prefs.includeOpenTasks !== false && open.length > 0) {
      html += `<p style="margin: 4px 0; color: #374151;"><strong>Open Tasks:</strong> ${open.length}</p>`;
      if (prefs.includeTaskNames !== false) {
        html += `<ul style="margin: 2px 0 8px 16px; padding: 0; list-style: none;">`;
        open.forEach(t => {
          const isOverdue = t.due && t.due < today;
          html += `<li style="margin: 2px 0; color: ${isOverdue ? '#e74c3c' : '#374151'}; font-size: 13px;">${t.title}${t.due ? ' (due ' + (()=>{ const p=t.due.split('-'); return parseInt(p[1])+'/'+parseInt(p[2])+'/'+p[0]; })() + ')' : ''}</li>`;
        });
        html += `</ul>`;
      }
    }
    if (prefs.includeOverdue !== false && overdue.length > 0)
      html += `<p style="margin: 4px 0; color: #e74c3c;"><strong>Overdue Tasks:</strong> ${overdue.length}</p>`;

    // Equipment alerts (managers only)
    if (isManager && prefs.includeEquipment !== false) {
      const eqSnap = await db.collection("locations").doc(loc.id).collection("equipment").where("status", "!=", "ok").get();
      if (!eqSnap.empty) {
        html += `<p style="margin: 4px 0; color: #e74c3c;"><strong>Equipment Alerts:</strong> ${eqSnap.docs.map(d => d.data().name).join(", ")}</p>`;
      }
    }

    html += `</td>${weatherHtml ? `<td valign="top" width="120" style="padding:14px 14px 14px 0;"><div style="background:#eff6ff;border-radius:8px;padding:10px;text-align:center;">${weatherHtml}</div></td>` : ""}</tr></table>`;
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
    subject: `WashLevel Daily Summary — ${displayDate}`,
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
      const isManager = (userData.role === "manager" || userData.role === "owner");
      const ownerId = userData.isTeamMember ? userData.ownerId : userDoc.id;
      const email = prefs.summaryEmail || userData.email;

      const locsSnap = await db.collection("locations").where("ownerId", "==", ownerId).get();
      const locations = locsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const allowedLocs = userData.isTeamMember
        ? locations.filter(l => (userData.allowedLocations || []).includes(l.id))
        : locations;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const etDate2 = yesterday.toLocaleString("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
      const [etMonth2, etDay2, etYear2] = etDate2.split("/");
      const dateStr = `${etYear2}-${etMonth2}-${etDay2}`;
      const displayDate = `${parseInt(etMonth2)}/${parseInt(etDay2)}/${etYear2}`;

      const resend = new Resend(RESEND_API_KEY.value());

      let html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #1a3352; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
          <img src="https://washlevel.com/email-logo-dark.png" alt="WashLevel" width="203" height="24" style="display:block;margin:0 auto;border:0;" />
          <p style="color: #fff; margin: 10px 0 0; font-size: 18px; font-weight: 600;">Daily Summary</p>
          <p style="color: #94a3b8; margin: 6px 0 0;">${displayDate}</p>
        </div>
        <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">`;

      let totalCars = 0;
      let totalDone = 0;
      let totalOpen = 0;
      let totalOverdue = 0;
      const today = new Date().toISOString().split("T")[0];

      for (const loc of allowedLocs) {
        // Fetch weather if enabled and location has zip/coords
        let weatherHtml = "";
        if (prefs.includeWeather) {
          try {
            let wLat = loc.lat, wLon = loc.lon;
            if ((!wLat || !wLon) && loc.zipCode) {
              const coords = await zipToCoords(loc.zipCode);
              if (coords) { wLat = coords.lat; wLon = coords.lon; }
            }
            if (wLat && wLon) {
              const wRes = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${wLat}&longitude=${wLon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&hourly=weathercode,precipitation&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America%2FNew_York&start_date=${dateStr}&end_date=${dateStr}`);
             const wData = await wRes.json();
             if (wData.daily) {
               const tMax = Math.round(wData.daily.temperature_2m_max[0]);
               const tMin = Math.round(wData.daily.temperature_2m_min[0]);
               const precip = wData.daily.precipitation_sum[0] || 0;
               const wcode = wData.daily.weathercode[0];
               const wDesc = wcode <= 1 ? "Clear" : wcode <= 3 ? "Partly Cloudy" : wcode <= 48 ? "Foggy" : wcode <= 67 ? "Rain" : wcode <= 77 ? "Snow" : wcode <= 82 ? "Showers" : "Stormy";
               const codeToSev = c => c >= 95 ? 7 : c >= 80 ? 6 : c >= 71 ? 5 : c >= 61 ? 4 : c >= 51 ? 3 : c >= 45 ? 2 : c >= 2 ? 1 : 0;
               const codeToWord = c => c >= 95 ? "Storms" : c >= 80 ? "Showers" : c >= 73 ? "Heavy Snow" : c >= 71 ? "Snow" : c >= 63 ? "Heavy Rain" : c >= 61 ? "Rain" : c >= 51 ? "Drizzle" : c >= 45 ? "Fog" : c >= 3 ? "Cloudy" : "Clear";
               let periodDesc = "";
               if (wData.hourly) {
                 const hC = wData.hourly.weathercode || [];
                 const hP = wData.hourly.precipitation || [];
                 const periods = [
                   { label: "Overnight", hours: [0,1,2,3,4,5] },
                   { label: "Morning", hours: [6,7,8,9,10,11] },
                   { label: "Afternoon", hours: [12,13,14,15,16,17] },
                   { label: "Evening", hours: [18,19,20,21,22,23] },
                 ];
                 let bestLabel = "", bestSev = 0, bestWord = "";
                 for (const p of periods) {
                   const maxC = Math.max(...p.hours.map(h => hC[h] || 0));
                   const totP = p.hours.reduce((s,h) => s+(hP[h]||0), 0);
                   const sev = codeToSev(maxC) + (totP > 0.05 ? 1 : 0);
                   if (sev > bestSev) { bestSev = sev; bestLabel = p.label; bestWord = codeToWord(maxC); }
                 }
                 if (bestLabel && bestSev > 1) periodDesc = bestLabel + " " + bestWord;
               }
               const wDisplay = periodDesc || wDesc;
               const wLine = '<div style="font-size:12px;font-weight:700;color:#1a3352;">' + wDisplay + '</div><div style="font-size:20px;font-weight:800;color:#1a3352;">' + tMax + '°F</div><div style="font-size:11px;color:#6b7280;">Low ' + tMin + '°F</div>' + (precip > 0 ? '<div style="font-size:11px;color:#3b82f6;">' + precip.toFixed(2) + '"</div>' : '');
               weatherHtml = wLine;
             }
             }
          } catch(e) { console.log("Weather error:", e.message); }
        }

        html += `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;border:2px solid #1a3352;border-radius:10px;margin:16px 0;">
            <tr><td style="padding:16px;" valign="top">
              <h2 style="color:#1a3352;font-size:16px;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #1a3352;">${loc.name}</h2>`;

        if (isManager && prefs.includeCounts !== false) {
          const countSnap = await db.collection("locations").doc(loc.id).collection("daySummaries").doc(dateStr).get();
          const summaryData = countSnap.exists ? countSnap.data() : {};
          const cars = summaryData.carsWashed || 0;
          totalCars += cars;

          const eqCountData = summaryData.equipment || {};
          const hasEqCounts = Object.keys(eqCountData).length > 0;

          if (hasEqCounts) {
            const eqSnap = await db.collection("locations").doc(loc.id).collection("equipment")
              .where("tracksCarCount", "==", true).get();
            const eqMap = {};
            eqSnap.docs.forEach(d => { eqMap[d.id] = d.data().name || d.id; });
            html += `<p style="margin: 4px 0; color: #374151;"><strong>Cars Washed:</strong> ${cars} total</p>`;
            html += `<div style="margin: 4px 0 8px 16px;">`;
            for (const [eqId, eqData] of Object.entries(eqCountData)) {
              const eqName = eqMap[eqId] || eqId;
              html += `<p style="margin: 2px 0; color: #6b7280; font-size: 13px;">${eqName}: <strong>${eqData.carsWashed || 0}</strong></p>`;
            }
            html += `</div>`;
          } else {
            html += `<p style="margin: 4px 0; color: #374151;"><strong>Cars Washed:</strong> ${cars}</p>`;
          }
        }

        const tasksSnap = await db.collection("locations").doc(loc.id).collection("tasks").get();
        const tasks = tasksSnap.docs.map(d => d.data());
        const done = tasks.filter(t => t.status === "done" && t.completedAt?.startsWith(dateStr));
        const open = tasks.filter(t => t.status !== "done" && !t.archived);
        const overdue = open.filter(t => t.due && t.due < today);

        totalDone += done.length;
        totalOpen += open.length;
        totalOverdue += overdue.length;

        if (prefs.includeTasksDone !== false && done.length > 0) {
          html += `<p style="margin: 4px 0; color: #374151;"><strong>Tasks Completed:</strong> ${done.length}</p>`;
          if (prefs.includeTaskNames !== false) {
            html += `<ul style="margin: 2px 0 8px 16px; padding: 0; list-style: none;">`;
            done.forEach(t => { html += `<li style="margin: 2px 0; color: #059669; font-size: 13px;">✓ ${t.title}</li>`; });
            html += `</ul>`;
          }
        }
        if (prefs.includeOpenTasks !== false && open.length > 0) {
          html += `<p style="margin: 4px 0; color: #374151;"><strong>Open Tasks:</strong> ${open.length}</p>`;
          if (prefs.includeTaskNames !== false) {
            html += `<ul style="margin: 2px 0 8px 16px; padding: 0; list-style: none;">`;
            open.forEach(t => {
              const isOverdue = t.due && t.due < today;
              html += `<li style="margin: 2px 0; color: ${isOverdue ? '#e74c3c' : '#374151'}; font-size: 13px;">${isOverdue ? '⚠ ' : '• '}${t.title}${t.due ? ' (due ' + t.due + ')' : ''}</li>`;
            });
            html += `</ul>`;
          }
        }
        if (prefs.includeOverdue !== false && overdue.length > 0)
          html += `<p style="margin: 4px 0; color: #e74c3c;"><strong>Overdue Tasks:</strong> ${overdue.length}</p>`;

        html += `</td>${weatherHtml ? `<td valign="top" width="130" style="padding:16px 16px 16px 0;">${weatherHtml}</td>` : ""}</tr></table>`;

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

  // Update lastReading on chemSensors config doc so the overview tile shows live data
  await db.collection("locations").doc(locationId)
    .collection("chemSensors").doc(sensorId)
    .set({ lastReading: parseFloat(value), updatedAt: timestamp }, { merge: true });

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

  // Update lastReading on chemSensors config doc so the overview tile shows live data
  await db.collection("locations").doc(locationId)
    .collection("chemSensors").doc(sensorId)
    .set({ lastReading: parseFloat(value), updatedAt: timestamp }, { merge: true });

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
    // If deviceId provided, get specific device status or control relay
    if (deviceId) {
      const { action, turn, channel } = request.data;
      if (action === "relay") {
        const url = `https://${cleanServer}/device/relay/control`;
        console.log("Relay control:", url, "device:", deviceId, "turn:", turn);
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `auth_key=${encodeURIComponent(authKey)}&id=${encodeURIComponent(deviceId)}&channel=${channel || 0}&turn=${turn}`
        });
        const data = await res.json();
        console.log("Relay control response:", JSON.stringify(data).slice(0, 200));
        return data;
      }
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
    
    // List all devices
    const listUrl = `https://${cleanServer}/interface/device/list`;
    console.log("Listing devices:", listUrl);
    const listRes = await fetch(listUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `auth_key=${encodeURIComponent(authKey)}`
    });
    const listData = await listRes.json();
    console.log("Device list response:", JSON.stringify(listData).slice(0, 500));
    if (listData.isok) return listData;
    
    // Fallback - verify key is valid
    const verifyUrl = `https://${cleanServer}/device/status`;
    const vRes = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `auth_key=${encodeURIComponent(authKey)}&id=verify`
    });
    const vData = await vRes.json();
    console.log("Verify response:", JSON.stringify(vData).slice(0, 200));
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
    let body = emailFull?.text || emailFull?.html || "";
    // Strip Gmail forward quote prefixes ("> " at start of lines)
    body = body.split("\n").map(l => l.replace(/^>+\s?/, "")).join("\n");
    console.log("Parsed body:", JSON.stringify(body.slice(0, 500)));
    const subject = emailFull?.subject || "";

    // Skip WashWorld (and any other machine) weekly/monthly summary emails — only process daily totals
    if (/weekly|monthly/i.test(subject) || /\b(week(?:ly)?|month(?:ly)?)\s+(total|report|summary)\b/i.test(body)) {
      console.log("Skipping weekly/monthly summary, subject:", subject);
      res.status(200).send("Skipped weekly/monthly");
      return;
    }

    // Extract location code from wash4821@washlevel.com
    const match = toFull.match(/([a-z]+\d+)@washlevel\.com/i);
    if (!match) { console.log("No location code in:", toFull); res.status(200).send("No location code"); return; }
    const locationCode = match[1].toLowerCase();
    console.log("Location code:", locationCode);
    
    // Parse car count - supports multiple equipment email formats
    let count = null;
    let extraData = {}; // Additional parsed fields (packages, revenue) stored alongside car count
    const isPDQ = /Laserwash.*Daily\s+Sales\s+Report/i.test(subject);
    // For PDQ, extract count from subject line (most reliable source)
    // Subject format: "Laserwash: S: Daily Sales Report :92"
    if (isPDQ) {
      const subjectCount = subject.match(/:\s*(\d+)\s*$/);
      if (subjectCount) count = parseInt(subjectCount[1]);
    }

    // Format 1: TOTAL = 16148: TODAY = 6 (Dencar)
    const todayMatch = body.match(/TODAY\s*=\s*(\d+)/i);
    if (todayMatch) { count = parseInt(todayMatch[1]); }

    // Format 2: Today's Total    2 (Accutrac)
    if (count === null) {
      const todaysTotalMatch = body.match(/Today'?s\s*Total\s+(\d+)/i);
      if (todaysTotalMatch) count = parseInt(todaysTotalMatch[1]);
    }

    // Format 3: Package rows - sum last column (FreeStyler + WASH DATA formats)
    // Handles "PACKAGE1  15364  9", "1  15364  9", and "1  ###  033" formats
    if (count === null && /PACKAGE RUNNING TODAY/i.test(body)) {
      const rows = body.match(/^\s*(?:PACKAGE)?\d+\s+[\d#]+\s+(\d+)\s*$/gim);
      if (rows && rows.length > 0) {
        count = rows.reduce((sum, row) => {
          const parts = row.trim().split(/\s+/);
          return sum + (parseInt(parts[parts.length - 1]) || 0);
        }, 0);
      }
    }

    // Format 4: PDQ Laserwash Daily Sales Report — "Total Washed = 92"
    // Must be checked before the generic TOTAL= fallback, which would otherwise
    // match the revenue line "Total = 882.000" and produce a wrong count.
    if (count === null) {
      const lwMatch = body.match(/Total\s+Washed\s*=\s*(\d+)/i);
      if (lwMatch) {
        count = parseInt(lwMatch[1]);
        // Parse package breakdown for future reporting
        const packages = {};
        for (const m of body.matchAll(/Package\s+(\d+)\s+(\d+)%/gi)) {
          packages[`pkg${m[1]}`] = { pct: parseInt(m[2]) };
        }
        for (const m of body.matchAll(/Package\s+(\d+):\s+(\d+)\s+x\s+([\d.]+)\s+=\s+([\d.]+)/gi)) {
          const k = `pkg${m[1]}`;
          packages[k] = { ...packages[k], count: parseInt(m[2]), price: parseFloat(m[3]), subtotal: parseFloat(m[4]) };
        }
        // "Total = 882.000" at end of cost breakdown section
        const revMatch = body.match(/^\s*Total\s*=\s*([\d.]+)\s*$/mi);
        const revenue = revMatch ? parseFloat(revMatch[1]) : null;
        if (Object.keys(packages).length > 0 || revenue !== null) {
          extraData = { packages, revenue };
        }
      }
    }

    // Format 5: TOTAL = 16 fallback — skipped for PDQ emails (subject-identified) to avoid
    // matching the revenue line "Total = 882.000". Other machines using this format are unaffected.
    if (count === null && !isPDQ) {
      const totalMatch = body.match(/TOTAL\s*=\s*(\d+)/i);
      if (totalMatch) count = parseInt(totalMatch[1]);
    }

    // Format 6: Total Washes: 6
    if (count === null) {
      const washMatch = body.match(/total\s*washes?\s*[:\-=]?\s*(\d+)/i);
      if (washMatch) count = parseInt(washMatch[1]);
    }

    // Format 8: D&S Equipment — "Yesterday 9"
    if (count === null) {
      const yestMatch = body.match(/^Yesterday\s+(\d+)\s*$/im);
      if (yestMatch) count = parseInt(yestMatch[1]);
    }

    // Format 7: WASH DATA / PACKAGE RUNNING TODAY with two-column rows
    // e.g. "  1      ###    033" or "  8      044    000"
    // TOTAL line: "TOTAL  016992    074" — second number is today's count
    // We sum the last column of each package row (more accurate, enables future breakdown)
    if (count === null && /WASH DATA/i.test(body) && /PACKAGE RUNNING TODAY/i.test(body)) {
      const pkgRows = [...body.matchAll(/^\s*(\d+)\s+[\d#]+\s+(\d+)\s*$/gim)];
      console.log("Format7 pkgRows found:", pkgRows.length, pkgRows.map(m => m[0].trim()));
      if (pkgRows.length > 0) {
        count = pkgRows.reduce((sum, m) => sum + parseInt(m[2]), 0);
        console.log("Format7 count:", count);
        const packages = {};
        pkgRows.forEach(m => { packages["pkg" + m[1]] = { count: parseInt(m[2]) }; });
        if (Object.keys(packages).length > 0) extraData = { packages };
      }
    }
    if (count === null) { console.log("No count in body:", body.slice(0,200)); res.status(200).send("No count found"); return; }
    
    // Use yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];
    
    // First try location-level emailCode
    const locsSnap = await db.collection("locations").where("emailCode", "==", locationCode).get();

    if (!locsSnap.empty) {
      const locId = locsSnap.docs[0].id;
      const summaryRef = db.collection("locations").doc(locId).collection("daySummaries").doc(dateStr);
      const existing = await summaryRef.get();
      const existingCount = existing.exists ? (existing.data().carsWashed || 0) : 0;
      const newCount = existingCount + count;
      await summaryRef.set({
        carsWashed: newCount, date: dateStr, source: "email", updatedAt: new Date().toISOString(),
        ...(Object.keys(extraData).length ? extraData : {}),
      }, { merge: true });
      console.log("Saved", count, "cars for location", locId, "on", dateStr);
      res.status(200).send("OK");
      return;
    }

    // Try equipment-level emailCode
    const allLocs = await db.collection("locations").get();
    let foundLocId = null;
    let foundEqId = null;

    for (const locDoc of allLocs.docs) {
      const eqSnap = await db.collection("locations").doc(locDoc.id)
        .collection("equipment").where("emailCode", "==", locationCode).get();
      if (!eqSnap.empty) {
        foundLocId = locDoc.id;
        foundEqId = eqSnap.docs[0].id;
        break;
      }
    }

    if (!foundLocId) {
      console.log("No location or equipment for code:", locationCode);
      res.status(200).send("Location not found");
      return;
    }

    // Write to equipment-specific day summary.
    // Use update() for existing docs — Admin SDK set() with dotted string keys creates literal
    // field names (e.g. "equipment.id.carsWashed") instead of nested objects, so the frontend's
    // data.equipment[id] read would always come back undefined. update() interprets dotted keys
    // as nested paths correctly.
    const eqSummaryRef = db.collection("locations").doc(foundLocId)
      .collection("daySummaries").doc(dateStr);
    const existingEqSummary = await eqSummaryRef.get();
    const existingEqCars = existingEqSummary.exists
      ? (existingEqSummary.data().equipment?.[foundEqId]?.carsWashed || 0)
      : 0;
    const newEqCount = count; // Set directly from email, not additive
    const existingEqData = existingEqSummary.exists ? (existingEqSummary.data().equipment || {}) : {};
    const existingLocCount = Object.entries(existingEqData).filter(([k]) => k !== foundEqId).reduce((s, [, v]) => s + (v.carsWashed || 0), 0);
    const newLocCount = existingLocCount + count;
    const nowStr = new Date().toISOString();

    if (existingEqSummary.exists) {
      await eqSummaryRef.update({
        [`equipment.${foundEqId}.carsWashed`]: newEqCount,
        [`equipment.${foundEqId}.date`]: dateStr,
        [`equipment.${foundEqId}.source`]: "email",
        [`equipment.${foundEqId}.updatedAt`]: nowStr,
        carsWashed: newLocCount,
        date: dateStr,
        updatedAt: nowStr,
        ...(Object.keys(extraData).length ? extraData : {}),
      });
    } else {
      await eqSummaryRef.set({
        equipment: {
          [foundEqId]: { carsWashed: newEqCount, date: dateStr, source: "email", updatedAt: nowStr },
        },
        carsWashed: newLocCount,
        date: dateStr,
        updatedAt: nowStr,
        ...(Object.keys(extraData).length ? extraData : {}),
      });
    }

    // Update equipment carsCount lifetime total
    const eqRef = db.collection("locations").doc(foundLocId).collection("equipment").doc(foundEqId);
    const eqDoc = await eqRef.get();
    const currentCarsCount = eqDoc.exists ? (eqDoc.data().carsCount || 0) : 0;
    const newCarsCount = currentCarsCount + count;
    await eqRef.update({ carsCount: newCarsCount, updatedAt: new Date().toISOString() });

    // Check if any car-recurrence tasks for this equipment are now due
    try {
      const tasksSnap = await db.collection("locations").doc(foundLocId).collection("tasks").get();
      const allCarTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Get location owner to notify
      const locDoc = await db.collection("locations").doc(foundLocId).get();
      const ownerId = locDoc.exists ? locDoc.data().ownerId : null;

      // Get owner prefs for car recurrence notifications
      let ownerPrefs = {};
      if (ownerId) {
        const prefsSnap = await db.collection("users").doc(ownerId).collection("prefs").doc("alerts").get();
        if (prefsSnap.exists) ownerPrefs = prefsSnap.data();
      }

      for (const t of allCarTasks.filter(t => t.equipmentId === foundEqId && t.nextCarsDue && t.status !== "done")) {
        const carsRemaining = t.nextCarsDue - newCarsCount;

        // Task is now due
        if (newCarsCount >= t.nextCarsDue) {
          await db.collection("locations").doc(foundLocId).collection("tasks").doc(t.id).update({
            due: dateStr, updatedAt: new Date().toISOString(),
          });
          console.log("Car recurrence triggered for task", t.id, "at", newCarsCount, "cars");

          // Notify if enabled
          if (ownerId && ownerPrefs.carRecurrenceDueAlert !== false) {
            const eqDoc = await db.collection("locations").doc(foundLocId).collection("equipment").doc(foundEqId).get();
            const eqName = eqDoc.exists ? eqDoc.data().name : "Equipment";
            const notifId = "notif" + Date.now() + t.id;
            await db.collection("users").doc(ownerId).collection("notifications").doc(notifId).set({
              id: notifId, type: "car_recurrence_due",
              title: "Task Due: " + t.title,
              body: eqName + " has reached " + newCarsCount.toLocaleString() + " cars. " + t.title + " is now due.",
              locationId: foundLocId, taskId: t.id,
              createdAt: new Date().toISOString(), read: false,
            });
          }
        }

        // Warning notification (approaching threshold)
        const warningThreshold = ownerPrefs.carRecurrenceWarningCars || 300;
        if (ownerPrefs.carRecurrenceWarningAlert && carsRemaining > 0 && carsRemaining <= warningThreshold && carsRemaining > 0) {
          const eqDoc = await db.collection("locations").doc(foundLocId).collection("equipment").doc(foundEqId).get();
          const eqName = eqDoc.exists ? eqDoc.data().name : "Equipment";
          const warnId = "warn" + Date.now() + t.id;
          await db.collection("users").doc(ownerId).collection("notifications").doc(warnId).set({
            id: warnId, type: "car_recurrence_warning",
            title: "Upcoming: " + t.title,
            body: eqName + " is " + carsRemaining.toLocaleString() + " cars away from " + t.title + ".",
            locationId: foundLocId, taskId: t.id,
            createdAt: new Date().toISOString(), read: false,
          });
        }
      }
    } catch(e) { console.log("Car recurrence check error:", e.message); }

    console.log("Saved", count, "cars for equipment", foundEqId, "at location", foundLocId, "on", dateStr);
    res.status(200).send("OK");
  } catch(e) {
    console.error("Error:", e.message);
    res.status(500).send("Error: " + e.message);
  }
});// updated Fri Apr  3 01:06:00 UTC 2026

exports.pressureLevel = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  if (req.headers["x-washlevel-secret"] !== "pressurelevel2025") return res.status(401).send("Unauthorized");

  const { device_id, location_id, location_name, sensor_label, city_water_psi, voltage, raw } = req.body;
  if (!device_id || !location_id || city_water_psi === undefined) return res.status(400).send("Missing required fields: device_id, location_id, city_water_psi");

  try {
    const psi = parseFloat(city_water_psi);
    const name = sensor_label || "City Water Pressure";
    const timestamp = new Date().toISOString();

    // Write latest reading to sensorReadings — this is what the Sensors detail view displays
    await db.collection("locations").doc(location_id)
      .collection("sensorReadings").doc(device_id)
      .set({ sensorId: device_id, name, value: psi, unit: "PSI", type: "pressure", locationId: location_id, timestamp, updatedAt: timestamp });

    // Write to sensorReadings history for time-series charts
    await db.collection("locations").doc(location_id)
      .collection("sensorReadings").doc(device_id)
      .collection("history").add({ sensorId: device_id, value: psi, unit: "PSI", timestamp });

    // Upsert chemSensors config doc — this is what the overview tile reads for lastReading.
    // merge:true so user-configured minAlert/maxAlert are never overwritten.
    await db.collection("locations").doc(location_id)
      .collection("chemSensors").doc(device_id)
      .set({ sensorId: device_id, name, unit: "PSI", type: "pressure", locationId: location_id, lastReading: psi, updatedAt: timestamp }, { merge: true });

    // Raw archive preserving voltage and ADC value
    await db.collection("locations").doc(location_id).collection("pressure_readings").add({
      device_id, location_id, location_name: location_name || null,
      sensor_label: name, city_water_psi: psi,
      voltage: voltage !== undefined ? parseFloat(voltage) : null,
      raw: raw !== undefined ? raw : null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ ok: true });
  } catch(e) {
    console.error("pressureLevel error:", e.message);
    res.status(500).send("Internal server error");
  }
});

exports.updateTimeclockEntry = onCall(async (request) => {
  if (!request.auth) throw new Error("Unauthorized");
  const { docId, locationTimes, mainClockIn, mainClockOut, sessions, editedBy, editedAt } = request.data;
  if (!docId) throw new Error("Missing docId");
  const update = { editedBy, editedAt };
  if (locationTimes !== undefined) update.locationTimes = locationTimes;
  if (mainClockIn !== undefined) update.mainClockIn = mainClockIn;
  if (mainClockOut !== undefined) update.mainClockOut = mainClockOut;
  if (sessions !== undefined) update.sessions = sessions;
  await db.collection("timeclock").doc(docId).update(update);
  return { ok: true };
});


// ── Stripe ────────────────────────────────────────────────────────────────────
const stripe = require("stripe");
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const STRIPE_PRICE_ID = "price_1TZEzsERWU7SaCxDl4sHacyY";
const WL_PLANS = {
  "price_1U7G4lERWU7SaCxDlw09PgzF": { name: "Single Site", limit: 1, price: 39 },
  "price_1U7G7MERWU7SaCxDT5a6OAwj": { name: "Operator", limit: 3, price: 49 },
  "price_1U7G7oERWU7SaCxDJxmerjlr": { name: "Regional", limit: 5, price: 100 },
  "price_1U7G9PERWU7SaCxDpc9Ff2Wi": { name: "Enterprise", limit: 10, price: 200 },
};

exports.createCheckoutSession = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const uid = request.auth.uid;
  const { email } = request.data;
  const stripeClient = stripe(STRIPE_SECRET_KEY.value());

  const session = await stripeClient.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    customer_email: email,
    line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    metadata: { firebaseUid: uid },
    success_url: "https://washlevel.com/?sms_success=1",
    cancel_url: "https://washlevel.com/?sms_cancel=1",
  });

  return { url: session.url };
});

exports.createPortalSession = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const uid = request.auth.uid;
  const stripeClient = stripe(STRIPE_SECRET_KEY.value());
  const subSnap = await db.collection("subscriptions").doc(uid).get();
  if (!subSnap.exists) throw new HttpsError("not-found", "No subscription found");
  const data = subSnap.data();
  const customerId = data.planStripeCustomerId || data.stripeCustomerId;
  if (!customerId) throw new HttpsError("not-found", "No billing account found");
  const session = await stripeClient.billingPortal.sessions.create({
    customer: customerId,
    return_url: "https://washlevel.com/",
  });
  return { url: session.url };
});

exports.createWashLevelCheckout = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const uid = request.auth.uid;
  const { email, priceId } = request.data;
  if (!WL_PLANS[priceId]) throw new HttpsError("invalid-argument", "Invalid plan");
  const stripeClient = stripe(STRIPE_SECRET_KEY.value());
  const session = await stripeClient.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { firebaseUid: uid, type: "washlevel_plan", priceId: priceId } },
    metadata: { firebaseUid: uid, type: "washlevel_plan", priceId: priceId },
    success_url: "https://washlevel.com/?plan_success=1",
    cancel_url: "https://washlevel.com/?plan_cancel=1",
  });
  return { url: session.url };
});
exports.stripeWebhook = onRequest({ secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] }, async (req, res) => {
  const stripeClient = stripe(STRIPE_SECRET_KEY.value());
  let event;
  try {
    event = stripeClient.webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET.value());
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send("Webhook Error");
  }

  const sub = event.data.object;
  let uid = sub.metadata?.firebaseUid;

  // If not on subscription, look it up from the checkout session
  if (!uid && sub.customer) {
    const stripeClient2 = stripe(STRIPE_SECRET_KEY.value());
    const sessions = await stripeClient2.checkout.sessions.list({ customer: sub.customer, limit: 5 });
    const session = sessions.data.find(s => s.metadata?.firebaseUid);
    uid = session?.metadata?.firebaseUid;
  }

  if (!uid) return res.json({ received: true });

  const subRef = db.collection("subscriptions").doc(uid);

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const active = sub.status === "active" || sub.status === "trialing";
    const until = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    if (sub.metadata?.type === "washlevel_plan") {
      const planInfo = WL_PLANS[sub.metadata.priceId] || { name: "Unknown", limit: 1 };
      await subRef.set({
        planActive: active, planName: planInfo.name, locationLimit: planInfo.limit,
        planPriceId: sub.metadata.priceId, planUntil: until,
        planStripeCustomerId: sub.customer, planStripeSubscriptionId: sub.id, planStripeStatus: sub.status,
      }, { merge: true });
    } else {
      await subRef.set({
        smsEnabled: active, smsEnabledUntil: until,
        stripeCustomerId: sub.customer, stripeSubscriptionId: sub.id, stripeStatus: sub.status,
      }, { merge: true });
    }
  } else if (event.type === "customer.subscription.deleted") {
    const existingDoc = await subRef.get();
    const data = existingDoc.exists ? existingDoc.data() : {};
    if (data.planStripeSubscriptionId === sub.id) {
      await subRef.set({ planActive: false, planStripeStatus: "canceled" }, { merge: true });
    } else {
      await subRef.set({ smsEnabled: false, stripeStatus: "canceled" }, { merge: true });
    }
  }

  res.json({ received: true });
});


// ── Telnyx SMS ────────────────────────────────────────────────────────────────
const TELNYX_API_KEY = defineSecret("TELNYX_API_KEY");
const TELNYX_FROM_NUMBER = "+17175500089"; // WashBoard/paystation
const TELNYX_FROM_WASHLEVEL = defineSecret("TELNYX_FROM_NUMBER"); // WashLevel alerts

async function sendSms(toNumber, message, apiKey, fromNumber = TELNYX_FROM_NUMBER) {
  const response = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      from: fromNumber,
      to: toNumber,
      text: message
    })
  });
  const data = await response.json();
  if (!response.ok) {
    console.error("Telnyx send failed:", response.status, JSON.stringify(data.errors));
    throw new Error(JSON.stringify(data.errors));
  }
  console.log("Telnyx queued:", data.data?.id, "from", fromNumber, "to", toNumber);
  return data;
}

exports.sendAlertSms = onCall({ secrets: [TELNYX_API_KEY, TELNYX_FROM_WASHLEVEL] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
  const { phone, message } = request.data;
  if (!phone || !message) throw new HttpsError("invalid-argument", "Phone and message required");
  await sendSms(phone, message, TELNYX_API_KEY.value(), TELNYX_FROM_WASHLEVEL.value());
  return { success: true };
});

// -- WashLevel: Auto-SMS on alert notifications --
// Fires when a notification doc is created for a user; texts them if their
// owner subscription is active, master + matching type toggle on, phone saved.
const SMS_TYPE_MAP = {
  sensor_alert: "sensorAlerts",
  equipment_failure: "equipmentFailures",
  chemical_low: "chemicalLevels",
  inspection_failed: "failedInspections",
};
exports.sendNotificationSms = onDocumentCreated(
  { document: "users/{uid}/notifications/{notifId}", secrets: [TELNYX_API_KEY, TELNYX_FROM_WASHLEVEL] },
  async (event) => {
    try {
      const notif = event.data && event.data.data();
      if (!notif) return;
      const uid = event.params.uid;
      const toggleKey = SMS_TYPE_MAP[notif.type];
      if (!toggleKey) return;
      const userDoc = await db.collection("users").doc(uid).get();
      if (!userDoc.exists) return;
      const u = userDoc.data();
      const prefs = u.smsPrefs || {};
      if (prefs.smsEnabled === false) return;
      if (!prefs[toggleKey]) return;
      if (!u.phone) return;
      const ownerId = u.ownerId || uid;
      const subDoc = await db.collection("subscriptions").doc(ownerId).get();
      const sub = subDoc.exists ? subDoc.data() : null;
      if (!sub || !sub.smsEnabled || !sub.smsEnabledUntil || new Date(sub.smsEnabledUntil) <= new Date()) return;
      const clean = (str) => (str || "").replace(/[^\x00-\x7F]/g, "").trim();
      let msg = "WashLevel: " + (clean(notif.title) || "Alert");
      const body = clean(notif.body);
      if (body) msg += "\n" + body;
      msg += "\nReply STOP to opt out.";
      const phone = u.phone.startsWith("+") ? u.phone : "+1" + u.phone.replace(/\D/g, "");
      try {
        await sendSms(phone, msg, TELNYX_API_KEY.value(), TELNYX_FROM_WASHLEVEL.value());
      } catch (e) {
        console.error("Notification SMS failed:", uid, e.message);
      }
    } catch (e) {
      console.error("sendNotificationSms error:", e);
    }
  }
);


// ══════════════════════════════════════════════════════════════════════════════
// ── WashBoard Cloud Functions ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// ── WashBoard: Send Receipt (SMS or Email) ────────────────────────────────────
exports.sendWashBoardReceipt = onRequest({ cors: true, secrets: [RESEND_API_KEY, TELNYX_API_KEY] }, async (req, res) => {
  if (req.method === "OPTIONS") { res.set("Access-Control-Allow-Origin", "*"); res.set("Access-Control-Allow-Methods", "POST, OPTIONS"); res.set("Access-Control-Allow-Headers", "Content-Type"); return res.status(204).send(""); }

  try {
    const { method, destination, sessionData } = req.body;
    // method: "sms" or "email"
    // destination: phone number or email address
    // sessionData: { washName, bayName, date, duration, subtotal, salesTax, total, functions: [{name, time}], transferCode, promoDiscount, promoCredit, logoUrl }

    if (!method || !destination || !sessionData) {
      return res.status(400).json({ error: "method, destination, and sessionData required" });
    }

    const { washName, bayName, date, duration, subtotal, salesTax, total, functions, transferCode, promoDiscount, promoCredit, logoUrl } = sessionData;

    if (method === "sms") {
      let msg = `${washName || "Self-Serve Wash"} — ${bayName || "Bay"}\n`;
      msg += `Date: ${date}\n`;
      msg += `Time: ${duration}\n`;
      msg += `Subtotal: $${(subtotal || 0).toFixed(2)}\n`;
      if (salesTax > 0) msg += `Tax: $${salesTax.toFixed(2)}\n`;
      msg += `Total: $${(total || 0).toFixed(2)}\n`;
      if (promoDiscount > 0) msg += `Promo: ${promoDiscount}% off\n`;
      if (promoCredit > 0) msg += `Promo credit: $${promoCredit.toFixed(2)}\n`;
      if (transferCode) msg += `Transfer code: ${transferCode}\n`;
      msg += `\nThank you for your wash!\n\nReply STOP to opt out.`;

      await sendSms(destination, msg, TELNYX_API_KEY.value());
      return res.json({ success: true, method: "sms" });
    }

    if (method === "email") {
      const resend = new Resend(RESEND_API_KEY.value());

      let fnRows = "";
      if (functions && functions.length > 0) {
        fnRows = functions.map(f =>
          `<tr><td style="padding: 8px 0; color: #cbd5e1; font-size: 13px; border-bottom: 1px solid #1e3a5f;">${f.name}</td><td style="padding: 8px 0; color: #e2e8f0; font-size: 13px; text-align: right; font-family: 'SF Mono', monospace; border-bottom: 1px solid #1e3a5f;">${f.time}</td></tr>`
        ).join("");
      }

      let promoLine = "";
      if (promoDiscount > 0) promoLine = `<tr><td style="padding: 8px 0; color: #00d4aa; font-size: 13px;">Promo Discount</td><td style="padding: 8px 0; color: #00d4aa; font-size: 13px; text-align: right; font-family: 'SF Mono', monospace;">${promoDiscount}% OFF</td></tr>`;
      if (promoCredit > 0) promoLine = `<tr><td style="padding: 8px 0; color: #00d4aa; font-size: 13px;">Promo Credit</td><td style="padding: 8px 0; color: #00d4aa; font-size: 13px; text-align: right; font-family: 'SF Mono', monospace;">$${promoCredit.toFixed(2)}</td></tr>`;

      let transferLine = "";
      if (transferCode) transferLine = `<div style="background: #0a1a10; border: 2px solid #00ff88; border-radius: 10px; padding: 16px; text-align: center; margin-top: 16px;"><div style="color: #6b7a8d; font-size: 10px; letter-spacing: 2px; margin-bottom: 6px;">TRANSFER CODE</div><div style="color: #00ff88; font-size: 28px; font-family: 'SF Mono', monospace; letter-spacing: 6px;">${transferCode}</div><div style="color: #f59e0b; font-size: 11px; margin-top: 6px;">Valid until 11:59 PM today</div></div>`;

      const logoSection = logoUrl ? `<img src="${logoUrl}" alt="${washName || 'Wash'}" style="max-width: 200px; max-height: 80px; width: auto; height: auto; margin-bottom: 12px;" />` : "";

      await resend.emails.send({
        from: "WashBoard <receipts@washboard.washlevel.com>",
        to: destination,
        subject: `Your wash receipt — ${washName || "Self-Serve Wash"}`,
        html: `
          <div style="font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #070e1a;">
            <div style="background: #0b1628; border-radius: 14px; padding: 28px; border: 1px solid #1e3a5f;">
              <div style="text-align: center; margin-bottom: 20px;">
                ${logoSection}
                <h1 style="color: #e2e8f0; margin: 0; font-size: 20px; font-weight: 700;">${washName || "Self-Serve Wash"}</h1>
                <p style="color: #6b7a8d; margin: 4px 0 0; font-size: 12px; letter-spacing: 2px;">${bayName || "Bay"}</p>
              </div>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px 0; color: #6b7a8d; font-size: 13px;">Date</td><td style="padding: 8px 0; color: #e2e8f0; font-size: 13px; text-align: right; font-family: 'SF Mono', monospace;">${date}</td></tr>
                <tr><td style="padding: 8px 0; color: #6b7a8d; font-size: 13px; border-bottom: 1px solid #1e3a5f;">Total Time</td><td style="padding: 8px 0; color: #e2e8f0; font-size: 13px; text-align: right; font-family: 'SF Mono', monospace; border-bottom: 1px solid #1e3a5f;">${duration}</td></tr>
                ${fnRows}
                ${promoLine}
                <tr><td style="padding: 8px 0; color: #6b7a8d; font-size: 13px;">Subtotal</td><td style="padding: 8px 0; color: #e2e8f0; font-size: 13px; text-align: right; font-family: 'SF Mono', monospace;">$${(subtotal || 0).toFixed(2)}</td></tr>
                ${salesTax > 0 ? `<tr><td style="padding: 8px 0; color: #6b7a8d; font-size: 13px;">Sales Tax</td><td style="padding: 8px 0; color: #e2e8f0; font-size: 13px; text-align: right; font-family: 'SF Mono', monospace;">$${salesTax.toFixed(2)}</td></tr>` : ""}
                <tr><td style="padding: 12px 0; color: #e2e8f0; font-size: 16px; font-weight: 700; border-top: 2px solid #1e3a5f;">Total</td><td style="padding: 12px 0; color: #ffaa22; font-size: 22px; font-weight: 700; text-align: right; font-family: 'SF Mono', monospace; border-top: 2px solid #1e3a5f;">$${(total || 0).toFixed(2)}</td></tr>
              </table>
              ${transferLine}
            </div>
            <p style="color: #4a5568; font-size: 10px; text-align: center; margin-top: 16px;">Powered by WashBoard &middot; washlevel.com</p>
          </div>
        `
      });
      return res.json({ success: true, method: "email" });
    }

    return res.status(400).json({ error: "method must be 'sms' or 'email'" });
  } catch (err) {
    console.error("sendWashBoardReceipt error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── WashBoard: Notify Operator of Issue ───────────────────────────────────────
exports.notifyOperatorIssue = onDocumentCreated({ document: "issues/{issueId}", secrets: [RESEND_API_KEY, TELNYX_API_KEY] }, async (event) => {
  try {
    const issue = event.data.data();
    const { ownerId, bayId, type, affectedFunction, callbackPhone, transferCode } = issue;
    if (!ownerId) return;

    // Look up bay config for bay name and attendant phone
    const bayDoc = await db.collection("bays").doc(bayId).get();
    const bay = bayDoc.exists ? bayDoc.data() : {};
    const bayName = bay.displayName || bay.washName || "Bay";
    const attendantPhone = bay.attendantPhone;

    // Look up owner for email
    const ownerDoc = await db.collection("users").doc(ownerId).get();
    const owner = ownerDoc.exists ? ownerDoc.data() : {};
    const ownerEmail = owner.email;

    const issueTypes = { functionNotWorking: "Function Not Working", leakingFitting: "Leaking Fitting", other: "Other Issue" };
    const issueLabel = issueTypes[type] || type || "Issue Reported";
    const fnLabel = affectedFunction != null ? ` — Function ${affectedFunction}` : "";

    // SMS to attendant phone
    if (attendantPhone && attendantPhone.length >= 10) {
      let msg = `⚠ WashBoard Issue — ${bayName}\n`;
      msg += `Type: ${issueLabel}${fnLabel}\n`;
      if (callbackPhone) msg += `Customer phone: ${callbackPhone}\n`;
      if (transferCode) msg += `Transfer code: ${transferCode}\n`;
      msg += `Time: ${new Date().toLocaleString("en-CA", { timeZone: "America/New_York" })}`;

      const phone = attendantPhone.startsWith("+") ? attendantPhone : `+1${attendantPhone.replace(/\D/g, "")}`;
      try { await sendSms(phone, msg, TELNYX_API_KEY.value()); } catch (e) { console.error("Issue SMS failed:", e); }
    }

    // Email to owner
    if (ownerEmail) {
      const resend = new Resend(RESEND_API_KEY.value());
      try {
        await resend.emails.send({
          from: "WashBoard <alerts@washboard.washlevel.com>",
          to: ownerEmail,
          subject: `Issue reported — ${bayName}`,
          html: `
            <div style="font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #070e1a;">
              <div style="background: #0b1628; border-radius: 14px; padding: 28px; border: 1px solid #1e3a5f;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                  <div style="width: 36px; height: 36px; background: #f59e0b22; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #f59e0b; font-size: 18px;">⚠</div>
                  <div><h2 style="color: #e2e8f0; margin: 0; font-size: 18px;">Issue Reported</h2><p style="color: #6b7a8d; margin: 0; font-size: 12px;">${bayName}</p></div>
                </div>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px 0; color: #6b7a8d; font-size: 13px;">Type</td><td style="padding: 8px 0; color: #e2e8f0; font-size: 13px; text-align: right;">${issueLabel}${fnLabel}</td></tr>
                  ${callbackPhone ? `<tr><td style="padding: 8px 0; color: #6b7a8d; font-size: 13px;">Customer Phone</td><td style="padding: 8px 0; color: #00d4aa; font-size: 13px; text-align: right; font-family: monospace;">${callbackPhone}</td></tr>` : ""}
                  ${transferCode ? `<tr><td style="padding: 8px 0; color: #6b7a8d; font-size: 13px;">Transfer Code</td><td style="padding: 8px 0; color: #00ff88; font-size: 15px; text-align: right; font-family: monospace; letter-spacing: 3px;">${transferCode}</td></tr>` : ""}
                  <tr><td style="padding: 8px 0; color: #6b7a8d; font-size: 13px;">Time</td><td style="padding: 8px 0; color: #e2e8f0; font-size: 13px; text-align: right;">${new Date().toLocaleString("en-CA", { timeZone: "America/New_York" })}</td></tr>
                </table>
                <a href="https://washboard.washlevel.com" style="display: block; background: #00d4aa; color: #070e1a; text-decoration: none; text-align: center; padding: 12px; border-radius: 8px; font-weight: 700; font-size: 14px; margin-top: 20px;">Open Dashboard</a>
              </div>
            </div>
          `
        });
      } catch (e) { console.error("Issue email failed:", e); }
    }
  } catch (err) {
    console.error("notifyOperatorIssue error:", err);
  }
});

// ── WashBoard: Daily Summary Email ────────────────────────────────────────────
exports.washBoardDailySummary = onSchedule({ schedule: "0 7 * * *", timeZone: "America/New_York", secrets: [RESEND_API_KEY] }, async () => {
  try {
    // Find all owners who have bays (and therefore use WashBoard)
    const baysSnap = await db.collection("bays").get();
    const ownerBays = {};
    baysSnap.forEach(doc => {
      const d = doc.data();
      if (!d.ownerId) return;
      if (!ownerBays[d.ownerId]) ownerBays[d.ownerId] = [];
      ownerBays[d.ownerId].push({ id: doc.id, ...d });
    });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const resend = new Resend(RESEND_API_KEY.value());

    for (const [ownerId, bays] of Object.entries(ownerBays)) {
      // Check if owner wants daily summary
      const ownerDoc = await db.collection("users").doc(ownerId).get();
      const owner = ownerDoc.exists ? ownerDoc.data() : null;
      if (!owner || !owner.email) continue;

      // Check preference (default to true for WashBoard users)
      const prefs = owner.washBoardPrefs || {};
      if (prefs.dailySummary === false) continue;

      // Fetch yesterday's sessions for this owner
      const sessionsSnap = await db.collection("sessions")
        .where("ownerId", "==", ownerId)
        .where("startedAt", ">=", admin.firestore.Timestamp.fromDate(yesterday))
        .where("startedAt", "<", admin.firestore.Timestamp.fromDate(today))
        .get();

      const sessions = [];
      sessionsSnap.forEach(doc => sessions.push({ id: doc.id, ...doc.data() }));

      // Fetch yesterday's issues
      const issuesSnap = await db.collection("issues")
        .where("ownerId", "==", ownerId)
        .where("reportedAt", ">=", admin.firestore.Timestamp.fromDate(yesterday))
        .where("reportedAt", "<", admin.firestore.Timestamp.fromDate(today))
        .get();

      const issues = [];
      issuesSnap.forEach(doc => issues.push({ id: doc.id, ...doc.data() }));

      const totalRevenue = sessions.reduce((sum, s) => sum + (s.totalCharge || 0), 0);
      const totalSessions = sessions.length;
      const totalIssues = issues.length;
      const avgDuration = totalSessions > 0
        ? sessions.reduce((sum, s) => {
            if (s.startedAt && s.endedAt) {
              return sum + (s.endedAt.toDate() - s.startedAt.toDate()) / 1000;
            }
            return sum;
          }, 0) / totalSessions
        : 0;
      const avgMins = Math.floor(avgDuration / 60);
      const avgSecs = Math.floor(avgDuration % 60);

      // Per-bay breakdown
      const bayStats = {};
      bays.forEach(b => { bayStats[b.id] = { name: b.displayName || b.washName || b.id, sessions: 0, revenue: 0 }; });
      sessions.forEach(s => {
        if (bayStats[s.bayId]) {
          bayStats[s.bayId].sessions++;
          bayStats[s.bayId].revenue += (s.totalCharge || 0);
        }
      });

      let bayRows = Object.values(bayStats).map(b =>
        `<tr><td style="padding: 6px 0; color: #cbd5e1; font-size: 13px; border-bottom: 1px solid #1e3a5f;">${b.name}</td><td style="padding: 6px 0; color: #e2e8f0; font-size: 13px; text-align: center; font-family: monospace; border-bottom: 1px solid #1e3a5f;">${b.sessions}</td><td style="padding: 6px 0; color: #00d4aa; font-size: 13px; text-align: right; font-family: monospace; border-bottom: 1px solid #1e3a5f;">$${b.revenue.toFixed(2)}</td></tr>`
      ).join("");

      const dateStr = yesterday.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });

      // Skip if no activity and no issues
      if (totalSessions === 0 && totalIssues === 0) continue;

      await resend.emails.send({
        from: "WashBoard <reports@washboard.washlevel.com>",
        to: owner.email,
        subject: `Daily Summary — ${dateStr} — $${totalRevenue.toFixed(2)} from ${totalSessions} washes`,
        html: `
          <div style="font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #070e1a;">
            <div style="background: #0b1628; border-radius: 14px; padding: 28px; border: 1px solid #1e3a5f; margin-bottom: 16px;">
              <h1 style="color: #e2e8f0; margin: 0 0 4px; font-size: 18px;">Daily Summary</h1>
              <p style="color: #6b7a8d; margin: 0 0 20px; font-size: 13px;">${dateStr}</p>

              <div style="display: flex; gap: 12px; margin-bottom: 20px;">
                <div style="flex: 1; background: #112240; border-radius: 10px; padding: 16px; text-align: center;">
                  <div style="color: #00d4aa; font-size: 26px; font-weight: 700; font-family: monospace;">$${totalRevenue.toFixed(2)}</div>
                  <div style="color: #6b7a8d; font-size: 10px; letter-spacing: 2px; margin-top: 4px;">REVENUE</div>
                </div>
                <div style="flex: 1; background: #112240; border-radius: 10px; padding: 16px; text-align: center;">
                  <div style="color: #e2e8f0; font-size: 26px; font-weight: 700; font-family: monospace;">${totalSessions}</div>
                  <div style="color: #6b7a8d; font-size: 10px; letter-spacing: 2px; margin-top: 4px;">WASHES</div>
                </div>
                <div style="flex: 1; background: #112240; border-radius: 10px; padding: 16px; text-align: center;">
                  <div style="color: #e2e8f0; font-size: 26px; font-weight: 700; font-family: monospace;">${avgMins}:${String(avgSecs).padStart(2, "0")}</div>
                  <div style="color: #6b7a8d; font-size: 10px; letter-spacing: 2px; margin-top: 4px;">AVG TIME</div>
                </div>
              </div>

              ${totalIssues > 0 ? `<div style="background: #f59e0b11; border: 1px solid #f59e0b33; border-radius: 8px; padding: 12px; margin-bottom: 20px;"><span style="color: #f59e0b; font-weight: 600; font-size: 13px;">${totalIssues} issue${totalIssues > 1 ? "s" : ""} reported</span></div>` : ""}

              ${bays.length > 1 ? `
              <h3 style="color: #6b7a8d; font-size: 11px; letter-spacing: 2px; margin: 0 0 10px;">BY BAY</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; color: #4a5568; font-size: 10px; letter-spacing: 1px;">BAY</td><td style="padding: 6px 0; color: #4a5568; font-size: 10px; letter-spacing: 1px; text-align: center;">WASHES</td><td style="padding: 6px 0; color: #4a5568; font-size: 10px; letter-spacing: 1px; text-align: right;">REVENUE</td></tr>
                ${bayRows}
              </table>` : ""}

              <a href="https://washboard.washlevel.com" style="display: block; background: #00d4aa; color: #070e1a; text-decoration: none; text-align: center; padding: 12px; border-radius: 8px; font-weight: 700; font-size: 14px; margin-top: 24px;">Open Dashboard</a>
            </div>
            <p style="color: #4a5568; font-size: 10px; text-align: center;">You're receiving this because daily summaries are enabled. Manage in WashBoard settings.</p>
          </div>
        `
      });

      console.log(`[WashBoard] Daily summary sent to ${owner.email}: $${totalRevenue.toFixed(2)} / ${totalSessions} sessions`);
    }
  } catch (err) {
    console.error("washBoardDailySummary error:", err);
  }
});

// ── WashBoard: Stripe Terminal — Create PaymentIntent ─────────────────────────
exports.createWashBoardPaymentIntent = onRequest({ cors: true, secrets: [STRIPE_SECRET_KEY] }, async (req, res) => {
  if (req.method === "OPTIONS") { res.set("Access-Control-Allow-Origin", "*"); res.set("Access-Control-Allow-Methods", "POST, OPTIONS"); res.set("Access-Control-Allow-Headers", "Content-Type"); return res.status(204).send(""); }

  try {
    const { amount } = req.body;  // Initial hold in cents (e.g. 500 = $5.00)
    const stripeClient = stripe(STRIPE_SECRET_KEY.value());

    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: amount || 500,
      currency: "usd",
      payment_method_types: ["card_present"],
      capture_method: "manual",
      payment_method_options: {
        card_present: {
          request_incremental_authorization_support: true,
          request_extended_authorization: true,
        }
      }
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      incrementalAuthSupported: true  // Will be confirmed after card is presented
    });
  } catch (err) {
    console.error("createWashBoardPaymentIntent error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── WashBoard: Stripe Terminal — Connection Token ─────────────────────────────
exports.createWashBoardConnectionToken = onRequest({ cors: true, secrets: [STRIPE_SECRET_KEY] }, async (req, res) => {
  if (req.method === "OPTIONS") { res.set("Access-Control-Allow-Origin", "*"); res.set("Access-Control-Allow-Methods", "POST, OPTIONS"); res.set("Access-Control-Allow-Headers", "Content-Type"); return res.status(204).send(""); }

  try {
    const stripeClient = stripe(STRIPE_SECRET_KEY.value());
    const token = await stripeClient.terminal.connectionTokens.create();
    return res.json({ secret: token.secret });
  } catch (err) {
    console.error("createWashBoardConnectionToken error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── WashBoard: Stripe Terminal — Increment Authorization ──────────────────────
exports.incrementWashBoardAuthorization = onRequest({ cors: true, secrets: [STRIPE_SECRET_KEY] }, async (req, res) => {
  if (req.method === "OPTIONS") { res.set("Access-Control-Allow-Origin", "*"); res.set("Access-Control-Allow-Methods", "POST, OPTIONS"); res.set("Access-Control-Allow-Headers", "Content-Type"); return res.status(204).send(""); }

  try {
    const { paymentIntentId, newAmount } = req.body;  // newAmount in cents
    if (!paymentIntentId || !newAmount) return res.status(400).json({ error: "paymentIntentId and newAmount required" });

    const stripeClient = stripe(STRIPE_SECRET_KEY.value());
    const updated = await stripeClient.paymentIntents.incrementAuthorization(paymentIntentId, {
      amount: newAmount
    });

    return res.json({
      paymentIntentId: updated.id,
      amount: updated.amount,
      status: updated.status
    });
  } catch (err) {
    // If incremental auth not supported, return gracefully so iPad can handle
    console.error("incrementWashBoardAuthorization error:", err);
    return res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
  }
});

// ── WashBoard: Stripe Terminal — Capture Payment ──────────────────────────────
exports.captureWashBoardPayment = onRequest({ cors: true, secrets: [STRIPE_SECRET_KEY] }, async (req, res) => {
  if (req.method === "OPTIONS") { res.set("Access-Control-Allow-Origin", "*"); res.set("Access-Control-Allow-Methods", "POST, OPTIONS"); res.set("Access-Control-Allow-Headers", "Content-Type"); return res.status(204).send(""); }

  try {
    const { paymentIntentId, finalAmount, amountToCapture } = req.body;  // amount in cents
    const captureAmount = amountToCapture != null ? amountToCapture : finalAmount;
    if (!paymentIntentId) return res.status(400).json({ error: "paymentIntentId required" });

    const stripeClient = stripe(STRIPE_SECRET_KEY.value());

    const captureParams = {};
    if (captureAmount != null) captureParams.amount_to_capture = captureAmount;

    const captured = await stripeClient.paymentIntents.capture(paymentIntentId, captureParams);

    return res.json({
      paymentIntentId: captured.id,
      amount: captured.amount_received,
      status: captured.status
    });
  } catch (err) {
    console.error("captureWashBoardPayment error:", err);
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ── WashBoard: Cancel uncaptured PaymentIntent ────────────────────────────────
exports.cancelWashBoardPayment = onRequest({ cors: true, secrets: [STRIPE_SECRET_KEY] }, async (req, res) => {
  if (req.method === "OPTIONS") { res.set("Access-Control-Allow-Origin", "*"); res.set("Access-Control-Allow-Methods", "POST, OPTIONS"); res.set("Access-Control-Allow-Headers", "Content-Type"); return res.status(204).send(""); }

  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) return res.status(400).json({ error: "paymentIntentId required" });

    const stripeClient = stripe(STRIPE_SECRET_KEY.value());
    const cancelled = await stripeClient.paymentIntents.cancel(paymentIntentId);

    return res.json({ paymentIntentId: cancelled.id, status: cancelled.status });
  } catch (err) {
    console.error("cancelWashBoardPayment error:", err);
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ── WashLevel Sidecar ─────────────────────────────────────────────────────────
const SIDECAR_PRICE_FOUNDING = "price_1U2brSERWU7SaCxDDvbIGlvn";
const SIDECAR_PRICE_STANDARD = "price_1U2bsLERWU7SaCxDgq8N4tqs";
const SIDECAR_FOUNDING_SLOTS = 10;
const SIDECAR_TRIAL_DAYS = 7;
const SIDECAR_SITE = "https://washlevel.com";
const SIDECAR_OWNER_KEY = "WLSC-OWNER-CAM1-2026";
const SIDECAR_WEBHOOK_SECRET = defineSecret("SIDECAR_WEBHOOK_SECRET");

function sidecarCors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

function sidecarKey() {
  const crypto = require("crypto");
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const grp = () =>
    Array.from(crypto.randomBytes(4)).map((b) => abc[b % abc.length]).join("");
  return `WLSC-${grp()}-${grp()}-${grp()}`;
}

// Founding slots are only consumed by full-price (non-comp) active licenses.
async function sidecarFoundingLeft() {
  const snap = await db
    .collection("sidecarLicenses")
    .where("active", "==", true)
    .where("comp", "==", false)
    .get();
  return Math.max(0, SIDECAR_FOUNDING_SLOTS - snap.size);
}

exports.sidecarPricing = onRequest(async (req, res) => {
  sidecarCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  try {
    const left = await sidecarFoundingLeft();
    res.json({ foundingLeft: left, slots: SIDECAR_FOUNDING_SLOTS, price: left > 0 ? 19 : 29 });
  } catch (e) {
    console.error("sidecarPricing", e);
    res.json({ foundingLeft: 0, slots: SIDECAR_FOUNDING_SLOTS, price: 29 });
  }
});

exports.createSidecarCheckout = onRequest({ secrets: [STRIPE_SECRET_KEY] }, async (req, res) => {
  sidecarCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  try {
    const email = (req.body && req.body.email) || undefined;
    const stripeClient = stripe(STRIPE_SECRET_KEY.value());
    const left = await sidecarFoundingLeft();
    const tier = left > 0 ? "founding" : "standard";
    const price = left > 0 ? SIDECAR_PRICE_FOUNDING : SIDECAR_PRICE_STANDARD;
    const session = await stripeClient.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      customer_email: email,
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: SIDECAR_TRIAL_DAYS,
        metadata: { product: "sidecar", tier },
      },
      metadata: { product: "sidecar", tier },
      success_url: `${SIDECAR_SITE}/sidecar-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SIDECAR_SITE}/sidecar.html`,
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error("createSidecarCheckout", e);
    res.status(500).json({ error: e.message });
  }
});

// Dedicated Sidecar webhook — separate endpoint and signing secret from stripeWebhook.
exports.sidecarWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, SIDECAR_WEBHOOK_SECRET, RESEND_API_KEY] },
  async (req, res) => {
    const stripeClient = stripe(STRIPE_SECRET_KEY.value());
    let event;
    try {
      event = stripeClient.webhooks.constructEvent(
        req.rawBody,
        req.headers["stripe-signature"],
        SIDECAR_WEBHOOK_SECRET.value()
      );
    } catch (e) {
      console.error("sidecarWebhook signature", e.message);
      return res.status(400).send(`Webhook Error: ${e.message}`);
    }

    try {
      if (event.type === "checkout.session.completed") {
        const s = event.data.object;
        if (!s.metadata || s.metadata.product !== "sidecar") return res.json({ received: true });

        const sub = await stripeClient.subscriptions.retrieve(s.subscription);
        const comp = !!(sub.discount || (sub.discounts && sub.discounts.length));
        const key = sidecarKey();
        const email = (s.customer_details && s.customer_details.email) || s.customer_email || "";

        await db.collection("sidecarLicenses").doc(key).set({
          key,
          email,
          stripeCustomerId: s.customer,
          stripeSubscriptionId: s.subscription,
          checkoutSessionId: s.id,
          status: sub.status,
          active: ["active", "trialing", "past_due"].includes(sub.status),
          comp,
          tier: comp ? "comp" : (s.metadata.tier || "standard"),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        if (email) {
          try {
            const resend = new Resend(RESEND_API_KEY.value());
            await resend.emails.send({
              from: "WashLevel <noreply@washlevel.com>",
              to: email,
              subject: "Your WashLevel Sidecar license key",
              html: `
      <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;">
        <div style="background:#1a3352;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
          <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">WashLevel Sidecar</h1>
          <p style="color:#94a3b8;margin:4px 0 0;font-size:12px;letter-spacing:2px;">A DENCAR UPGRADE EXPERIENCE</p>
        </div>
        <div style="background:#fff;border-radius:12px;padding:28px;">
          <h2 style="color:#111827;font-size:20px;margin:0 0 8px;">You're in.</h2>
          <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 20px;">Here's your license key. Paste it into Sidecar's Settings tab to unlock syncing.</p>
          <div style="background:#f1f5f9;border:1px dashed #94a3b8;border-radius:8px;padding:16px;text-align:center;font-family:monospace;font-size:18px;letter-spacing:1px;color:#1a3352;font-weight:700;">${key}</div>
          <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:20px 0 0;">Your first 7 days are free. Installation instructions are at washlevel.com/sidecar.html</p>
        </div>
      </div>`,
            });
          } catch (mailErr) {
            console.error("sidecar license email", mailErr);
          }
        }
      }

      if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
        const sub = event.data.object;
        if (!sub.metadata || sub.metadata.product !== "sidecar") return res.json({ received: true });
        const snap = await db
          .collection("sidecarLicenses")
          .where("stripeSubscriptionId", "==", sub.id)
          .get();
        const active =
          event.type !== "customer.subscription.deleted" &&
          ["active", "trialing", "past_due"].includes(sub.status);
        for (const d of snap.docs) {
          await d.ref.set({ status: sub.status, active }, { merge: true });
        }
      }

      res.json({ received: true });
    } catch (e) {
      console.error("sidecarWebhook", e);
      res.status(500).send("error");
    }
  }
);

exports.validateSidecarLicense = onRequest(async (req, res) => {
  sidecarCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  try {
    const raw = (req.body && req.body.key) || req.query.key || "";
    const key = String(raw).trim().toUpperCase();
    if (!key) return res.json({ valid: false, reason: "no-key" });
    if (key === SIDECAR_OWNER_KEY) return res.json({ valid: true, plan: "owner" });
    const doc = await db.collection("sidecarLicenses").doc(key).get();
    if (!doc.exists) return res.json({ valid: false, reason: "not-found" });
    const d = doc.data();
    res.json({
      valid: !!d.active,
      plan: d.tier || "standard",
      status: d.status || null,
      reason: d.active ? null : d.status || "inactive",
    });
  } catch (e) {
    console.error("validateSidecarLicense", e);
    res.status(500).json({ valid: false, reason: "server-error" });
  }
});

exports.sidecarLicenseBySession = onRequest(async (req, res) => {
  sidecarCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  try {
    const sid = String(req.query.session_id || "").trim();
    if (!sid) return res.json({ ready: false });
    const snap = await db
      .collection("sidecarLicenses")
      .where("checkoutSessionId", "==", sid)
      .limit(1)
      .get();
    if (snap.empty) return res.json({ ready: false });
    const d = snap.docs[0].data();
    res.json({ ready: true, key: d.key, email: d.email || "" });
  } catch (e) {
    console.error("sidecarLicenseBySession", e);
    res.json({ ready: false });
  }
});

exports.createSidecarPortalSession = onRequest({ secrets: [STRIPE_SECRET_KEY] }, async (req, res) => {
  sidecarCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  try {
    const raw = (req.body && req.body.key) || req.query.key || "";
    const key = String(raw).trim().toUpperCase();
    if (!key) return res.status(400).json({ error: "no-key" });
    if (key === SIDECAR_OWNER_KEY) return res.status(400).json({ error: "owner-key-no-billing" });
    const doc = await db.collection("sidecarLicenses").doc(key).get();
    if (!doc.exists) return res.status(404).json({ error: "not-found" });
    const d = doc.data();
    if (!d.stripeCustomerId) return res.status(400).json({ error: "no-customer" });
    const stripeClient = stripe(STRIPE_SECRET_KEY.value());
    const session = await stripeClient.billingPortal.sessions.create({
      customer: d.stripeCustomerId,
      return_url: `${SIDECAR_SITE}/sidecar`,
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error("createSidecarPortalSession", e);
    res.status(500).json({ error: e.message });
  }
});


// ══════════════════════════════════════════════════════════════════════════════
// ── WashBoard Device & Bay Alerts ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
//
// Two entry points:
//   notifyWashBoardDeviceHealth — onDocumentWritten on bays/{bayId}. Catches
//     conditions the iPad reports: power unplugged, low battery, overheating.
//   sweepWashBoardBayHealth — onSchedule every 5 min. Catches conditions defined
//     by ABSENCE of writes: stale heartbeat, unreachable relay.
//
// Dedupe state lives in washboardAlertState/{bayId}, NOT on the bay doc, so the
// alert write never re-triggers the bay listener.

const ALERT_DEFAULTS = {
  issueReported:   { sms: true,  email: false },
  relayDown:       { sms: true,  email: false },
  bayOffline:      { sms: true,  email: false },
  powerUnplugged:  { sms: true,  email: false },
  batteryLow:      { sms: false, email: true  },
  thermalCritical: { sms: true,  email: false },
};

const ALERT_LABELS = {
  relayDown:       "Relay unreachable",
  bayOffline:      "Bay offline",
  powerUnplugged:  "Power disconnected",
  batteryLow:      "Battery low",
  thermalCritical: "Device overheating",
};

async function wbLoadAlertContext(bay) {
  let location = null;
  if (bay.locationId) {
    const locDoc = await db.collection("washboardLocations").doc(bay.locationId).get();
    if (locDoc.exists) location = locDoc.data();
  }
  if (!location && bay.ownerId) {
    const locSnap = await db.collection("washboardLocations")
      .where("ownerId", "==", bay.ownerId).limit(1).get();
    if (!locSnap.empty) location = locSnap.docs[0].data();
  }
  if (!location) {
    console.error(`wbLoadAlertContext FOUND NO LOCATION - locationId=${bay.locationId || "unset"} ownerId=${bay.ownerId || "unset"}`);
    location = {};
  }
  const settings = location.alertSettings || {};
  return {
    location,
    phones: (location.alertPhones || []).filter(x => x && x.replace(/\D/g, "").length >= 10),
    emails: (location.alertEmails || []).filter(x => x && x.includes("@")),
    consent: location.smsConsent === true,
    threshold: typeof location.batteryAlertThreshold === "number" ? location.batteryAlertThreshold : 50,
    timezone: location.timezone || "America/New_York",
    settingFor: key => settings[key] || ALERT_DEFAULTS[key] || { sms: false, email: false },
  };
}

function wbAlertEmailHtml(title, bayName, rows, accent) {
  const cells = rows.map(r =>
    `<tr><td style="padding:8px 0;color:#6b7a8d;font-size:13px;">${r[0]}</td>` +
    `<td style="padding:8px 0;color:#e2e8f0;font-size:13px;text-align:right;">${r[1]}</td></tr>`
  ).join("");
  return `
    <div style="font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#070e1a;">
      <div style="background:#0b1628;border-radius:14px;padding:28px;border:1px solid #1e3a5f;">
        <h2 style="color:${accent};margin:0 0 2px;font-size:18px;">${title}</h2>
        <p style="color:#6b7a8d;margin:0 0 16px;font-size:12px;">${bayName}</p>
        <table style="width:100%;border-collapse:collapse;">${cells}</table>
        <a href="https://washboard.washlevel.com/#devices" style="display:block;background:#00d4aa;color:#070e1a;text-decoration:none;text-align:center;padding:12px;border-radius:8px;font-weight:700;font-size:14px;margin-top:20px;">Open Dashboard</a>
      </div>
    </div>`;
}

/**
 * Fires or resolves one condition, deduped against washboardAlertState.
 * Returns true if anything was sent.
 */
async function wbHandleCondition(bayId, bay, ctx, key, isActive, detail) {
  const stateRef = db.collection("washboardAlertState").doc(bayId);
  const stateDoc = await stateRef.get();
  const state = stateDoc.exists ? stateDoc.data() : {};
  const wasActive = state[key]?.active === true;

  if (isActive === wasActive) return false;

  await stateRef.set({
    [key]: { active: isActive, changedAt: admin.firestore.FieldValue.serverTimestamp() },
    ownerId: bay.ownerId || null,
  }, { merge: true });

  const route = ctx.settingFor(key);
  console.log(`wbDebug ${bayId} ${key} active=${isActive} was=${wasActive} ` +
    `sms=${route.sms} email=${route.email} phones=${ctx.phones.length} emails=${ctx.emails.length} consent=${ctx.consent}`);
  if (!route.sms && !route.email) return false;

  const bayName = bay.displayName || bay.washName || bayId;
  const label = ALERT_LABELS[key] || key;
  const when = new Date().toLocaleString("en-CA", { timeZone: ctx.timezone });
  const title = isActive ? label : label + " - resolved";
  const accent = isActive ? "#ef4444" : "#22c55e";

  if (route.sms && ctx.consent && ctx.phones.length > 0) {
    let msg = `WashBoard - ${bayName}\n${title}\n`;
    if (detail) msg += `${detail}\n`;
    msg += when;
    for (const raw of ctx.phones) {
      const phone = raw.startsWith("+") ? raw : "+1" + raw.replace(/\D/g, "");
      try { await sendSms(phone, msg, TELNYX_API_KEY.value()); }
      catch (e) { console.error(`Alert SMS failed (${key}, ${phone}):`, e.message); }
    }
  }

  if (route.email && ctx.emails.length > 0) {
    const resend = new Resend(RESEND_API_KEY.value());
    const rows = [["Condition", label], ["Status", isActive ? "Active" : "Resolved"]];
    if (detail) rows.push(["Detail", detail]);
    rows.push(["Time", when]);
    try {
      await resend.emails.send({
        from: "WashBoard <alerts@washboard.washlevel.com>",
        to: ctx.emails,
        subject: `${title} - ${bayName}`,
        html: wbAlertEmailHtml(title, bayName, rows, accent),
      });
    } catch (e) { console.error(`Alert email failed (${key}):`, e.message); }
  }

  console.log(`[WashBoard] ${bayId} ${key} -> ${isActive ? "ACTIVE" : "resolved"}`);
  return true;
}

// ── Device health conditions reported by the iPad ─────────────────────────────
exports.notifyWashBoardDeviceHealth = onDocumentWritten(
  { document: "bays/{bayId}", secrets: [RESEND_API_KEY, TELNYX_API_KEY] },
  async (event) => {
    const after = event.data?.after?.data();
    if (!after) return;

    const before = event.data?.before?.data() || {};
    const watched = ["thermalState", "powerState", "batteryLevel"];
    const changed = watched.filter(f => before[f] !== after[f]);
    if (changed.length === 0) return;
    console.log(`wbDebug ${event.params.bayId} changed=[${changed.join(",")}] ` +
      `power=${before.powerState}->${after.powerState} ` +
      `battery=${before.batteryLevel}->${after.batteryLevel} ` +
      `thermal=${before.thermalState}->${after.thermalState}`);

    try {
      const bayId = event.params.bayId;
      const ctx = await wbLoadAlertContext(after);
      console.log(`wbDebug ctx locationId=${after.locationId || "NONE"} ownerId=${after.ownerId || "NONE"} ` +
        `phones=${ctx.phones.length} emails=${ctx.emails.length} consent=${ctx.consent} threshold=${ctx.threshold}`);

      await wbHandleCondition(bayId, after, ctx, "thermalCritical",
        after.thermalState === "critical",
        after.thermalState ? `Thermal state: ${after.thermalState}` : null);

      await wbHandleCondition(bayId, after, ctx, "powerUnplugged",
        after.powerState === "unplugged",
        typeof after.batteryLevel === "number" ? `Battery at ${after.batteryLevel}%` : null);

      const low = typeof after.batteryLevel === "number"
        && after.batteryLevel >= 0
        && after.batteryLevel < ctx.threshold;
      await wbHandleCondition(bayId, after, ctx, "batteryLow", low,
        typeof after.batteryLevel === "number"
          ? `Battery at ${after.batteryLevel}% (threshold ${ctx.threshold}%)` : null);

    } catch (e) {
      console.error("notifyWashBoardDeviceHealth failed:", e);
    }
  }
);

// ── Conditions defined by absence: stale heartbeat, unreachable relay ─────────
exports.sweepWashBoardBayHealth = onSchedule(
  { schedule: "*/5 * * * *", timeZone: "America/New_York", secrets: [RESEND_API_KEY, TELNYX_API_KEY] },
  async () => {
    const baysSnap = await db.collection("bays").get();
    const now = Date.now();
    const ctxCache = new Map();

    for (const bayDoc of baysSnap.docs) {
      const bay = bayDoc.data();
      if (!bay.deviceId) continue;

      try {
        const cacheKey = bay.locationId || bay.ownerId || "none";
        if (!ctxCache.has(cacheKey)) ctxCache.set(cacheKey, await wbLoadAlertContext(bay));
        const ctx = ctxCache.get(cacheKey);

        const hb = bay.lastHeartbeat?.toMillis ? bay.lastHeartbeat.toMillis() : 0;
        const interval = typeof bay.heartbeatInterval === "number" ? bay.heartbeatInterval : 30;
        const ageSec = hb ? Math.round((now - hb) / 1000) : null;
        const offline = hb ? (now - hb) > (interval * 3000) : true;

        await wbHandleCondition(bayDoc.id, bay, ctx, "bayOffline", offline,
          ageSec !== null ? `No heartbeat for ${Math.round(ageSec / 60)} min` : "Never reported in");

        // relayConnected is not written yet; skip until the iPad reports it
        if (typeof bay.relayConnected === "boolean" && !offline) {
          await wbHandleCondition(bayDoc.id, bay, ctx, "relayDown", !bay.relayConnected,
            bay.relayHost ? `Relay at ${bay.relayHost}` : null);
        }

      } catch (e) {
        console.error(`sweepWashBoardBayHealth failed for ${bayDoc.id}:`, e);
      }
    }
  }
);
