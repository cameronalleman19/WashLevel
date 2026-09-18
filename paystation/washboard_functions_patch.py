cd /workspaces/WashLevel
python3 washboard_functions_patch.pyimport pathlib
p = pathlib.Path('functions/index.js')
s = p.read_text()

anchor = '// ── WashLevel Sidecar ─────────────────────────────────────────────────────────'
assert s.count(anchor) == 1, 'Sidecar anchor not found'

washboard_block = r'''
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
      msg += `\nThank you for your wash!`;

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

      const logoSection = logoUrl ? `<img src="${logoUrl}" alt="${washName || 'Wash'}" style="max-height: 60px; margin-bottom: 12px;" />` : "";

      await resend.emails.send({
        from: "WashBoard <receipts@washlevel.com>",
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
    const bayDoc = await db.collection("bays").document(bayId).get();
    const bay = bayDoc.exists ? bayDoc.data() : {};
    const bayName = bay.displayName || bay.washName || "Bay";
    const attendantPhone = bay.attendantPhone;

    // Look up owner for email
    const ownerDoc = await db.collection("users").document(ownerId).get();
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
          from: "WashBoard <alerts@washlevel.com>",
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
        from: "WashBoard <reports@washlevel.com>",
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
          request_extended_authorization_support: true,
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
    const { paymentIntentId, finalAmount } = req.body;  // finalAmount in cents
    if (!paymentIntentId) return res.status(400).json({ error: "paymentIntentId required" });

    const stripeClient = stripe(STRIPE_SECRET_KEY.value());

    const captureParams = {};
    if (finalAmount != null) captureParams.amount_to_capture = finalAmount;

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

''' + '// ── WashLevel Sidecar ─────────────────────────────────────────────────────────'

s = s.replace(anchor, washboard_block)
p.write_text(s)
print('OK — WashBoard Cloud Functions added')
print('Functions added:')
print('  - sendWashBoardReceipt (HTTP) — SMS/email receipt to customer')
print('  - notifyOperatorIssue (Firestore trigger) — SMS + email to operator on issue')
print('  - washBoardDailySummary (scheduled 7am ET) — daily email summary')
print('  - createWashBoardPaymentIntent (HTTP) — Stripe Terminal with incremental auth')
print('  - createWashBoardConnectionToken (HTTP) — Stripe Terminal connection token')
print('  - incrementWashBoardAuthorization (HTTP) — step up hold by $5')
print('  - captureWashBoardPayment (HTTP) — capture final amount')
print('  - cancelWashBoardPayment (HTTP) — cancel uncaptured hold')
