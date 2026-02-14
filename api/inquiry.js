const nodemailer = require("nodemailer");

function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(payload));
}

function clean(value) {
  return String(value || "").trim().replace(/[\r\n]+/g, " ");
}

function normalizeDomain(input) {
  const raw = clean(input).toLowerCase();
  if (!raw) return "";

  const pathMatch = raw.match(/\/(w3\.[a-z0-9.-]+)(?:\/|$)/i);
  if (pathMatch) return pathMatch[1].toLowerCase();

  const noProto = raw.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const host = noProto.split("/")[0];
  if (/^w3\.[a-z0-9.-]+$/.test(host)) return host;

  return "";
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      const params = new URLSearchParams(req.body);
      return Object.fromEntries(params.entries());
    }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};

  const ctype = String(req.headers["content-type"] || "").toLowerCase();
  if (ctype.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return {};
    }
  }
  if (ctype.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(raw);
    return Object.fromEntries(params.entries());
  }
  return {};
}

function buildText(payload, domain) {
  const lines = [
    "New inquiry received.",
    "",
    `Domain: ${domain || "unknown"}`,
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
  ];

  if (payload.company) lines.push(`Company: ${payload.company}`);
  if (payload.phone) lines.push(`Phone: ${payload.phone}`);
  if (payload.country) lines.push(`Country: ${payload.country}`);
  if (payload.role) lines.push(`Role: ${payload.role}`);
  if (payload.budget) lines.push(`Budget: ${payload.budget}`);
  if (payload.timeline) lines.push(`Timeline: ${payload.timeline}`);
  if (payload.intent) lines.push(`Intent: ${payload.intent}`);
  if (payload.nda) lines.push(`NDA requested: ${payload.nda}`);
  if (payload.ackSevenFigure) lines.push(`Seven-figure acknowledgement: ${payload.ackSevenFigure}`);

  lines.push("", "Message:", payload.message);
  return lines.join("\n");
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const data = await readBody(req);
    if (clean(data.website)) return json(res, 200, { ok: true }); // honeypot

    const payload = {
      name: clean(data.fullName || data.name),
      email: clean(data.email),
      company: clean(data.company),
      phone: clean(data.phone),
      country: clean(data.country),
      role: clean(data.role),
      budget: clean(data.budget),
      timeline: clean(data.timeline),
      intent: clean(data.intent),
      nda: clean(data.nda),
      ackSevenFigure: clean(data.ackSevenFigure || data.sevenFigure),
      message: clean(data.message || data.notes),
      domain: clean(data.domain || data.site),
    };

    if (!payload.name || !payload.email || !payload.message) {
      return json(res, 400, { ok: false, error: "Missing required fields." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      return json(res, 400, { ok: false, error: "Invalid email." });
    }
    if (payload.message.length < 10) {
      return json(res, 400, { ok: false, error: "Please enter a message (10+ characters)." });
    }

    const smtpHost = process.env.SMTP_HOST || "smtppro.zoho.com";
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    const smtpEncryption = (process.env.SMTP_ENCRYPTION || "ssl").toLowerCase();
    const smtpUser = process.env.SMTP_USERNAME || "";
    const smtpPass = process.env.SMTP_PASSWORD || "";

    if (!smtpUser || !smtpPass) {
      return json(res, 500, { ok: false, error: "SMTP is not configured." });
    }

    const domain = normalizeDomain(payload.domain || req.headers.origin || req.headers.referer || "");
    const toEmail = process.env.INQUIRY_TO_EMAIL || smtpUser;
    const fromName = process.env.INQUIRY_FROM_NAME || "W3 Domain Inquiries";

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpEncryption === "ssl" || smtpPort === 465,
      requireTLS: smtpEncryption === "tls",
      auth: { user: smtpUser, pass: smtpPass },
    });

    const subject = `New inquiry${domain ? ` - ${domain}` : ""} - ${payload.name}`;
    const text = buildText(payload, domain);

    await transporter.sendMail({
      from: `${fromName} <${smtpUser}>`,
      to: toEmail,
      replyTo: `${payload.name} <${payload.email}>`,
      subject,
      text,
    });

    return json(res, 200, { ok: true });
  } catch (err) {
    console.error("inquiry_send_failed", err);
    return json(res, 500, { ok: false, error: "Email sending failed." });
  }
};
