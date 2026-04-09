import type { APIRoute } from "astro";
import nodemailer from "nodemailer";
import { commercialContent } from "../../config/commercial";
import { createHash, randomUUID } from "node:crypto";

const DEFAULT_LEAD_DESTINATION_EMAIL =
  "soporte@importacionesamexico.com.mx" as const;
const BRAND_SITE_URL = "https://friopuro.com.mx" as const;
const BRAND_LOGO_URL = `${BRAND_SITE_URL}/images/FrioPuroLogo.png` as const;
const CUSTOMER_WHATSAPP_URL = "https://wa.link/38bbke" as const;
const RECAPTCHA_ACTION = "corporate_quote_submit" as const;
const DEFAULT_RECAPTCHA_MIN_SCORE = 0.5;

const RATE_LIMIT_PER_MINUTE = 5;
const RATE_LIMIT_PER_HOUR = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_HOUR_MS = 60 * 60_000;

const MAX_CONCURRENT_REQUESTS = 5;
const MAX_BODY_BYTES = 64 * 1024;

type ApiPayload = {
  ok: boolean;
  code: string;
  message: string;
};

type RateLimitState = {
  minuteStart: number;
  minuteCount: number;
  hourStart: number;
  hourCount: number;
};

const rateLimitByKey = new Map<string, RateLimitState>();
let activeRequests = 0;
let lastRateLimitCleanupAt = 0;

const json = (status: number, payload: ApiPayload): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const createRequestId = (): string => {
  try {
    return randomUUID();
  } catch {
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  }
};

const hashClientKey = (key: string): string => {
  try {
    return createHash("sha256").update(key).digest("hex").slice(0, 12);
  } catch {
    return "";
  }
};

const logSecurityEvent = (event: {
  request_id: string;
  code: string;
  client_ref?: string;
  detail?: string;
}) => {
  try {
    const payload = {
      ts: new Date().toISOString(),
      ...event,
    };
    console.info(JSON.stringify(payload));
  } catch {
    // ignore
  }
};

const isPrivateIp = (ip: string): boolean => {
  const v = ip.trim();
  if (!v) return false;
  if (v === "::1") return true;
  if (v.startsWith("127.")) return true;
  if (v.startsWith("10.")) return true;
  if (v.startsWith("192.168.")) return true;
  if (v.startsWith("172.")) {
    const second = Number.parseInt(v.split(".")[1] || "", 10);
    return Number.isFinite(second) && second >= 16 && second <= 31;
  }
  return false;
};

const isValidIpToken = (token: string): boolean => {
  const value = token.trim();
  if (!value) return false;
  // Basic allowlist (IPv4/IPv6-ish). Purpose: avoid letting arbitrary strings become keys.
  return /^[0-9a-fA-F:.]+$/.test(value);
};

const getTrustedClientIp = (
  request: Request,
  clientAddress?: string,
): string => {
  const ctxIp = (clientAddress || "").trim();
  const cfIp = (request.headers.get("cf-connecting-ip") || "").trim();
  const realIp = (request.headers.get("x-real-ip") || "").trim();
  const xForwardedFor = (request.headers.get("x-forwarded-for") || "").trim();

  // Source of truth: runtime-provided clientAddress when available.
  if (ctxIp && isValidIpToken(ctxIp)) {
    // Trust proxy-provided headers only when the immediate peer is a private/loopback address
    // (i.e., a local trusted reverse proxy). Otherwise, do not trust user-supplied headers.
    if (isPrivateIp(ctxIp)) {
      if (cfIp && isValidIpToken(cfIp)) return cfIp;
      if (realIp && isValidIpToken(realIp)) return realIp;

      const firstForwarded = (xForwardedFor.split(",")[0] || "").trim();
      if (firstForwarded && isValidIpToken(firstForwarded))
        return firstForwarded;
    }
    return ctxIp;
  }

  // No reliable runtime address: do not trust forwarded headers.
  return "";
};

const getClientKey = (request: Request, clientAddress?: string): string => {
  const ip = getTrustedClientIp(request, clientAddress);
  if (ip) return `ip:${ip}`;

  const ua = (request.headers.get("user-agent") || "").trim();
  const acceptLanguage = (request.headers.get("accept-language") || "").trim();
  const secChUa = (request.headers.get("sec-ch-ua") || "").trim();
  const origin = (request.headers.get("origin") || "").trim();

  const fingerprint = [
    ua.slice(0, 120),
    acceptLanguage.slice(0, 80),
    secChUa.slice(0, 80),
    origin.slice(0, 120),
  ]
    .filter(Boolean)
    .join("|");

  return fingerprint ? `fp:${fingerprint}` : "unknown";
};

const isRateLimited = (key: string): boolean => {
  const now = Date.now();
  const existing = rateLimitByKey.get(key);

  // Conservative cleanup: occasionally sweep entries that are well past both windows.
  if (now - lastRateLimitCleanupAt > 10 * 60_000 && rateLimitByKey.size > 250) {
    lastRateLimitCleanupAt = now;
    const expireBeforeMinute = now - RATE_LIMIT_WINDOW_MS * 2;
    const expireBeforeHour = now - RATE_LIMIT_HOUR_MS * 2;

    for (const [storedKey, state] of rateLimitByKey.entries()) {
      if (
        state.minuteStart < expireBeforeMinute &&
        state.hourStart < expireBeforeHour
      ) {
        rateLimitByKey.delete(storedKey);
      }
    }
  }

  const state: RateLimitState =
    existing ??
    ({
      minuteStart: now,
      minuteCount: 0,
      hourStart: now,
      hourCount: 0,
    } satisfies RateLimitState);

  if (now - state.minuteStart >= RATE_LIMIT_WINDOW_MS) {
    state.minuteStart = now;
    state.minuteCount = 0;
  }

  if (now - state.hourStart >= RATE_LIMIT_HOUR_MS) {
    state.hourStart = now;
    state.hourCount = 0;
  }

  state.minuteCount += 1;
  state.hourCount += 1;
  rateLimitByKey.set(key, state);

  return (
    state.minuteCount > RATE_LIMIT_PER_MINUTE ||
    state.hourCount > RATE_LIMIT_PER_HOUR
  );
};

const CONSUMPTION_LABELS: Record<string, string> = {
  lt_50: "Menos de 50 bolsas / semana",
  "50_150": "50 a 150 bolsas / semana",
  gt_150: "Más de 150 bolsas / semana",
};

const getString = (value: FormDataEntryValue | null): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const sanitizeLine = (value: string): string => {
  return value.replace(/[\r\n]+/g, " ").trim();
};

const isValidEmail = (email: string): boolean => {
  if (!email) return true;
  if (email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const verifyRecaptchaToken = async (
  token: string,
  secretKey: string,
): Promise<{ ok: true } | { ok: false; unavailable: boolean }> => {
  const minScoreRaw = (
    import.meta.env.RECAPTCHA_MIN_SCORE as string | undefined
  )?.trim();
  const parsedMinScore = Number(minScoreRaw ?? DEFAULT_RECAPTCHA_MIN_SCORE);
  const minScore =
    Number.isFinite(parsedMinScore) &&
    parsedMinScore >= 0 &&
    parsedMinScore <= 1
      ? parsedMinScore
      : DEFAULT_RECAPTCHA_MIN_SCORE;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          secret: secretKey,
          response: token,
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) return { ok: false, unavailable: false };

    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      action?: string;
      score?: number;
    } | null;

    const score = typeof payload?.score === "number" ? payload.score : null;
    const scorePassed = score === null ? false : score >= minScore;

    const passed =
      Boolean(payload?.success) &&
      payload?.action === RECAPTCHA_ACTION &&
      scorePassed;

    return passed ? { ok: true } : { ok: false, unavailable: false };
  } catch {
    return { ok: false, unavailable: true };
  } finally {
    clearTimeout(timeoutId);
  }
};

const isAllowedHost = (host: string): boolean => {
  const value = host.trim().toLowerCase();
  if (!value) return false;
  const hostname = value.split(":")[0] || "";
  return (
    hostname === "friopuro.com.mx" ||
    hostname === "www.friopuro.com.mx" ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost")
  );
};

const isAllowedOrigin = (origin: string): boolean => {
  const value = origin.trim().toLowerCase();
  if (!value) return false;

  // Allow browser "null" origins only if explicitly needed (we do not allow them here).
  if (value === "null") return false;

  return (
    value === "https://friopuro.com.mx" ||
    value === "https://www.friopuro.com.mx" ||
    value === "http://localhost:4321" ||
    value === "http://127.0.0.1:4321"
  );
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const formatConsumptionBadgeColor = (consumption: string): string => {
  if (consumption === CONSUMPTION_LABELS.gt_150) return "#0f766e";
  if (consumption === CONSUMPTION_LABELS["50_150"]) return "#1d4ed8";
  return "#475569";
};

const formatLeadTimestamp = (isoDate: string): string => {
  const date = new Date(isoDate);

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(date);
};

const getMailerConfig = () => {
  const user = (
    (import.meta.env.GMAIL_USER as string | undefined) ?? ""
  ).trim();
  const pass = (
    (import.meta.env.GMAIL_APP_PASSWORD as string | undefined) ?? ""
  ).trim();
  const leadDestination =
    (
      (import.meta.env.LEAD_DESTINATION_EMAIL as string | undefined) ?? ""
    ).trim() ||
    user ||
    DEFAULT_LEAD_DESTINATION_EMAIL;

  return { user, pass, leadDestination };
};

const sendEmailWithGmail = async (options: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  gmailUser?: string;
  gmailPass?: string;
}): Promise<void> => {
  const cfg = getMailerConfig();
  const user = (options.gmailUser ?? cfg.user).trim();
  const pass = (options.gmailPass ?? cfg.pass).trim();

  if (!user || !pass) {
    throw new Error("Mailer is not configured");
  }
  const to = Array.isArray(options.to) ? options.to : [options.to];

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user,
      pass,
    },
  });

  await transporter.sendMail({
    from: `"Frio Puro" <${user}>`,
    to,
    subject: options.subject,
    text: options.text,
    ...(options.html ? { html: options.html } : {}),
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
  });
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const requestId = createRequestId();
  let clientKey = "";
  let clientRef = "";
  try {
    const hostHeader = (request.headers.get("host") || "").trim();
    const originHeader = (request.headers.get("origin") || "").trim();

    // If Origin is present (browser fetch/forms), enforce it strictly.
    if (originHeader) {
      if (!isAllowedOrigin(originHeader)) {
        logSecurityEvent({
          request_id: requestId,
          code: "invalid_origin",
          detail: "origin_not_allowed",
        });
        return json(403, {
          ok: false,
          code: "invalid_origin",
          message: "Solicitud no permitida.",
        });
      }
    } else {
      // If Origin is absent, fall back to validating Host (prevents obvious cross-site misuse and misrouting).
      if (!isAllowedHost(hostHeader)) {
        logSecurityEvent({
          request_id: requestId,
          code: "invalid_origin",
          detail: "host_not_allowed",
        });
        return json(403, {
          ok: false,
          code: "invalid_origin",
          message: "Solicitud no permitida.",
        });
      }
    }

    clientKey = getClientKey(request, clientAddress);
    clientRef = hashClientKey(clientKey);

    if (isRateLimited(clientKey)) {
      logSecurityEvent({
        request_id: requestId,
        code: "rate_limited",
        client_ref: clientRef,
      });
      return json(429, {
        ok: false,
        code: "rate_limited",
        message: "Demasiadas solicitudes, intenta más tarde",
      });
    }

    if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
      logSecurityEvent({
        request_id: requestId,
        code: "server_busy",
        client_ref: clientRef,
      });
      return json(503, {
        ok: false,
        code: "server_busy",
        message: "Servicio temporalmente no disponible",
      });
    }

    const secretKey =
      (import.meta.env.RECAPTCHA_SECRET_KEY as string | undefined)?.trim() ||
      "";
    const gmailUser =
      (import.meta.env.GMAIL_USER as string | undefined)?.trim() || "";
    const gmailPass =
      (import.meta.env.GMAIL_APP_PASSWORD as string | undefined)?.trim() || "";
    const leadDestination =
      (import.meta.env.LEAD_DESTINATION_EMAIL as string | undefined)?.trim() ||
      gmailUser ||
      DEFAULT_LEAD_DESTINATION_EMAIL;

    if (!secretKey || !gmailUser || !gmailPass) {
      logSecurityEvent({
        request_id: requestId,
        code: "service_misconfigured",
        client_ref: clientRef,
      });
      return json(503, {
        ok: false,
        code: "service_misconfigured",
        message: "Servicio temporalmente no disponible",
      });
    }

    const contentLengthRaw = (
      request.headers.get("content-length") || ""
    ).trim();
    if (contentLengthRaw) {
      const contentLength = Number.parseInt(contentLengthRaw, 10);
      if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
        logSecurityEvent({
          request_id: requestId,
          code: "invalid_input",
          client_ref: clientRef,
          detail: "content_length_exceeded",
        });
        return json(400, {
          ok: false,
          code: "invalid_input",
          message: "Verifica los datos e intenta nuevamente.",
        });
      }
    }

    activeRequests += 1;

    try {
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        return json(400, {
          ok: false,
          code: "invalid_request",
          message: "No fue posible procesar tu solicitud. Verifica los datos.",
        });
      }

      const honeypot = getString(formData.get("company_website"));
      if (honeypot) {
        return json(200, {
          ok: true,
          code: "ok",
          message:
            "Gracias. Tu solicitud fue enviada correctamente. Nuestro equipo comercial dará seguimiento a la brevedad.",
        });
      }

      const nameCompany = getString(formData.get("name_company"));
      const phone = getString(formData.get("phone"));
      const email = getString(formData.get("email"));
      const consumption = getString(formData.get("consumption"));
      const recaptchaToken = getString(formData.get("g-recaptcha-response"));
      const messageField = getString(formData.get("message"));

      if (
        nameCompany.length > 300 ||
        phone.length > 120 ||
        email.length > 320 ||
        messageField.length > 2000 ||
        honeypot.length > 400
      ) {
        logSecurityEvent({
          request_id: requestId,
          code: "invalid_input",
          client_ref: clientRef,
          detail: "field_length_exceeded",
        });
        return json(400, {
          ok: false,
          code: "invalid_input",
          message: "Verifica los datos e intenta nuevamente.",
        });
      }

      const consumptionLabel = CONSUMPTION_LABELS[consumption] ?? "";
      const safeNameCompany = sanitizeLine(nameCompany);
      const safePhone = sanitizeLine(phone);

      if (!safeNameCompany) {
        return json(400, {
          ok: false,
          code: "validation_error",
          message: "Indica tu nombre o empresa.",
        });
      }

      if (safeNameCompany.length > 140) {
        return json(400, {
          ok: false,
          code: "validation_error",
          message: "El nombre o empresa es demasiado largo.",
        });
      }

      if (!safePhone) {
        return json(400, {
          ok: false,
          code: "validation_error",
          message: "Indica un teléfono de contacto.",
        });
      }

      if (safePhone.length > 40) {
        return json(400, {
          ok: false,
          code: "validation_error",
          message: "El teléfono es demasiado largo.",
        });
      }

      if (!isValidEmail(email)) {
        return json(400, {
          ok: false,
          code: "validation_error",
          message: "Revisa el formato del correo electrónico.",
        });
      }

      if (!consumptionLabel) {
        return json(400, {
          ok: false,
          code: "validation_error",
          message: "Selecciona tu consumo estimado.",
        });
      }

      if (!recaptchaToken) {
        return json(400, {
          ok: false,
          code: "recaptcha_failed",
          message: "Confirma que no eres un robot.",
        });
      }

      const recaptchaResult = await verifyRecaptchaToken(
        recaptchaToken,
        secretKey,
      );

      if (!recaptchaResult.ok) {
        if (recaptchaResult.unavailable) {
          logSecurityEvent({
            request_id: requestId,
            code: "recaptcha_unavailable",
            client_ref: clientRef,
          });
          return json(503, {
            ok: false,
            code: "recaptcha_unavailable",
            message: "Servicio temporalmente no disponible",
          });
        }

        return json(400, {
          ok: false,
          code: "recaptcha_failed",
          message: "No fue posible validar reCAPTCHA. Intenta nuevamente.",
        });
      }

      const receivedAt = new Date().toISOString();
      const receivedAtFormatted = formatLeadTimestamp(receivedAt);
      const origin = "/cotizacion-corporativa";
      const originLabel = "Formulario corporativo web";
      const whatsappHref = CUSTOMER_WHATSAPP_URL;
      const safeEmail = email || "No proporcionado";
      const consumptionColor = formatConsumptionBadgeColor(consumptionLabel);
      const leadWhatsAppHref = `https://wa.me/${safePhone.replace(/\D/g, "")}`;
      const leadMailtoHref = email ? `mailto:${encodeURIComponent(email)}` : "";

      const internalSubject = `Nueva solicitud de cotización: ${safeNameCompany} | Frío Puro`;
      const internalText = [
        "Nueva solicitud de cotización recibida desde el formulario web.",
        "",
        `Nombre / Empresa: ${safeNameCompany}`,
        `Teléfono: ${safePhone}`,
        `Correo electrónico: ${safeEmail}`,
        `Consumo estimado: ${consumptionLabel}`,
        `Fecha/hora: ${receivedAtFormatted} (México)`,
        `Origen: ${originLabel} (${origin})`,
        "",
        "Acciones sugeridas:",
        `- Responder por correo a: ${safeEmail}`,
        `- Contactar por teléfono o WhatsApp: ${safePhone}`,
      ].join("\n");
      const internalHtml = `
    <div style="background:#f3f7fb;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #dbe7f3;border-radius:18px;overflow:hidden;">
        <div style="padding:24px 28px;background:linear-gradient(135deg,#05203d 0%,#0b4f7c 100%);color:#ffffff;">
          <img src="${BRAND_LOGO_URL}" alt="Frío Puro" width="136" style="display:block;width:136px;max-width:100%;height:auto;margin:0 0 18px;" />
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;opacity:0.75;">Nueva solicitud de cotización</p>
          <h1 style="margin:0;font-size:28px;line-height:1.1;">${escapeHtml(safeNameCompany)}</h1>
          <p style="margin:12px 0 0;font-size:15px;line-height:1.5;opacity:0.9;">Solicitud de cotización corporativa recibida en Frío Puro.</p>
        </div>
        <div style="padding:28px;">
          <div style="margin-bottom:22px;padding:18px;border-radius:14px;background:#eff6ff;border:1px solid #bfdbfe;">
            <p style="margin:0 0 10px;font-size:15px;color:#0f172a;font-weight:700;">Acciones rápidas</p>
            <div>
              ${
                email
                  ? `<a href="${escapeHtml(leadMailtoHref)}" style="display:inline-block;margin:0 10px 10px 0;padding:12px 18px;border-radius:999px;background:#0a6ba8;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Responder por correo</a>`
                  : ""
              }
              <a href="${escapeHtml(leadWhatsAppHref)}" style="display:inline-block;margin:0 10px 10px 0;padding:12px 18px;border-radius:999px;background:#25d366;color:#05203d;font-size:14px;font-weight:700;text-decoration:none;">Abrir WhatsApp</a>
            </div>
          </div>
          <table role="presentation" style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:0 0 14px;font-size:14px;color:#475569;">Teléfono</td>
              <td style="padding:0 0 14px;font-size:15px;color:#0f172a;font-weight:700;text-align:right;">${escapeHtml(safePhone)}</td>
            </tr>
            <tr>
              <td style="padding:0 0 14px;font-size:14px;color:#475569;">Correo electrónico</td>
              <td style="padding:0 0 14px;font-size:15px;color:#0f172a;font-weight:700;text-align:right;">${escapeHtml(safeEmail)}</td>
            </tr>
            <tr>
              <td style="padding:0 0 14px;font-size:14px;color:#475569;">Consumo estimado</td>
              <td style="padding:0 0 14px;text-align:right;">
                <span style="display:inline-block;padding:8px 12px;border-radius:999px;background:${consumptionColor};color:#ffffff;font-size:13px;font-weight:700;">${escapeHtml(consumptionLabel)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:0 0 14px;font-size:14px;color:#475569;">Fecha</td>
              <td style="padding:0 0 14px;font-size:15px;color:#0f172a;font-weight:700;text-align:right;">${escapeHtml(receivedAtFormatted)}</td>
            </tr>
            <tr>
              <td style="padding:0;font-size:14px;color:#475569;">Origen</td>
              <td style="padding:0;font-size:15px;color:#0f172a;font-weight:700;text-align:right;">${escapeHtml(originLabel)}</td>
            </tr>
          </table>
          <div style="margin-top:24px;padding:18px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;">
            <p style="margin:0 0 12px;font-size:14px;color:#334155;font-weight:700;">Siguiente paso recomendado</p>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">Da seguimiento por teléfono o WhatsApp y envía una propuesta comercial según el volumen solicitado.</p>
          </div>
          <p style="margin:22px 0 0;font-size:13px;line-height:1.7;color:#64748b;">Ruta: ${escapeHtml(origin)}.<br/>Buzón de destino: ${escapeHtml(leadDestination)}</p>
        </div>
      </div>
    </div>
  `;

      try {
        await sendEmailWithGmail({
          to: leadDestination,
          subject: internalSubject,
          text: internalText,
          html: internalHtml,
          replyTo: email || undefined,
          gmailUser,
          gmailPass,
        });
      } catch {
        logSecurityEvent({
          request_id: requestId,
          code: "smtp_unavailable",
          client_ref: clientRef,
        });
        return json(503, {
          ok: false,
          code: "smtp_unavailable",
          message: "Servicio temporalmente no disponible",
        });
      }

      let userConfirmationSent = false;
      if (email) {
        const userSubject =
          "Recibimos tu solicitud y ya estamos preparando tu cotización | Frío Puro";
        const userText = [
          "Hola,",
          "",
          "Gracias por contactar a Frío Puro.",
          "",
          "Ya recibimos tu solicitud de cotización corporativa y nuestro equipo comercial la revisará para prepararte una propuesta acorde a tu operación.",
          "",
          "Resumen enviado:",
          `- Nombre / Empresa: ${safeNameCompany}`,
          `- Teléfono: ${safePhone}`,
          `- Correo electrónico: ${email}`,
          `- Consumo estimado: ${consumptionLabel}`,
          "",
          "Tiempo estimado de respuesta: menos de 24 horas.",
          `Si necesitas atención inmediata, también puedes escribirnos por WhatsApp al ${commercialContent.whatsappNumberRaw}.`,
          "",
          "Atentamente,",
          "Equipo comercial de Frío Puro",
          "ventas@friopuro.com.mx",
        ].join("\n");
        const userHtml = `
      <div style="background:#edf4f9;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #dbe7f3;border-radius:20px;overflow:hidden;">
          <div style="padding:28px 28px 24px;background:linear-gradient(135deg,#062b4f 0%,#0a6ba8 100%);color:#ffffff;">
            <img src="${BRAND_LOGO_URL}" alt="Frío Puro" width="140" style="display:block;width:140px;max-width:100%;height:auto;margin:0 0 18px;" />
            <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;opacity:0.76;">Solicitud recibida</p>
            <h1 style="margin:0;font-size:30px;line-height:1.1;">Gracias por contactar a Frío Puro</h1>
            <p style="margin:14px 0 0;font-size:16px;line-height:1.6;opacity:0.92;">Nuestro equipo comercial ya recibió tu solicitud y preparará una propuesta según el volumen y la operación de tu negocio.</p>
          </div>
          <div style="padding:28px;">
            <div style="margin-bottom:22px;padding:18px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;">
              <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#0f172a;">Tiempo estimado de respuesta</p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">Menos de 24 horas. Si necesitamos información adicional, te contactaremos por teléfono o correo.</p>
            </div>
            <p style="margin:0 0 14px;font-size:15px;font-weight:700;color:#0f172a;">Resumen de tu solicitud</p>
            <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0 10px;">
              <tr>
                <td style="width:38%;padding:12px 14px;border-radius:12px 0 0 12px;background:#eff6ff;color:#334155;font-size:14px;">Nombre / Empresa</td>
                <td style="padding:12px 14px;border-radius:0 12px 12px 0;background:#f8fafc;color:#0f172a;font-size:14px;font-weight:700;">${escapeHtml(safeNameCompany)}</td>
              </tr>
              <tr>
                <td style="padding:12px 14px;border-radius:12px 0 0 12px;background:#eff6ff;color:#334155;font-size:14px;">Teléfono</td>
                <td style="padding:12px 14px;border-radius:0 12px 12px 0;background:#f8fafc;color:#0f172a;font-size:14px;font-weight:700;">${escapeHtml(safePhone)}</td>
              </tr>
              <tr>
                <td style="padding:12px 14px;border-radius:12px 0 0 12px;background:#eff6ff;color:#334155;font-size:14px;">Correo electrónico</td>
                <td style="padding:12px 14px;border-radius:0 12px 12px 0;background:#f8fafc;color:#0f172a;font-size:14px;font-weight:700;">${escapeHtml(email)}</td>
              </tr>
              <tr>
                <td style="padding:12px 14px;border-radius:12px 0 0 12px;background:#eff6ff;color:#334155;font-size:14px;">Consumo estimado</td>
                <td style="padding:12px 14px;border-radius:0 12px 12px 0;background:#f8fafc;color:#0f172a;font-size:14px;font-weight:700;">${escapeHtml(consumptionLabel)}</td>
              </tr>
            </table>
            <div style="margin-top:24px;padding:20px;border-radius:16px;background:#05203d;color:#e2eef7;">
              <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#ffffff;">Atención inmediata</p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">Si necesitas coordinar entregas o resolver una duda urgente, puedes escribirnos directamente por WhatsApp.</p>
              <a href="${escapeHtml(whatsappHref)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#25d366;color:#05203d;font-size:14px;font-weight:700;text-decoration:none;">Escribir por WhatsApp</a>
            </div>
            <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#64748b;">Frío Puro<br/>${escapeHtml(commercialContent.whatsappNumberRaw)}<br/><a href="mailto:ventas@friopuro.com.mx" style="color:#0a6ba8;text-decoration:none;">ventas@friopuro.com.mx</a></p>
          </div>
        </div>
      </div>
    `;

        try {
          await sendEmailWithGmail({
            to: email,
            subject: userSubject,
            text: userText,
            html: userHtml,
            gmailUser,
            gmailPass,
          });
          userConfirmationSent = true;
        } catch {
          // Complementario: no romper el flujo principal si el lead interno ya salió.
        }
      }

      return json(200, {
        ok: true,
        code: "ok",
        message:
          email && userConfirmationSent
            ? "Gracias. Tu solicitud fue enviada correctamente. Nuestro equipo comercial dará seguimiento a la brevedad y te enviaremos confirmación por correo."
            : "Gracias. Tu solicitud fue enviada correctamente. Nuestro equipo comercial dará seguimiento a la brevedad.",
      });
    } finally {
      activeRequests = Math.max(0, activeRequests - 1);
    }
  } catch {
    logSecurityEvent({
      request_id: requestId,
      code: "internal_error",
      client_ref: clientRef,
    });
    return json(500, {
      ok: false,
      code: "internal_error",
      message: "Servicio temporalmente no disponible",
    });
  }
};
