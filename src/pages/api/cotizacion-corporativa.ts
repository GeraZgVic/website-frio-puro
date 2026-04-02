import type { APIRoute } from "astro";
import nodemailer from "nodemailer";
import { commercialContent } from "../../config/commercial";

const DEFAULT_LEAD_DESTINATION_EMAIL = "soporte@importacionesamexico.com.mx" as const;
const BRAND_SITE_URL = "https://friopuro.com.mx" as const;
const BRAND_LOGO_URL = `${BRAND_SITE_URL}/images/FrioPuroLogo.png` as const;
const CUSTOMER_WHATSAPP_URL = "https://wa.link/38bbke" as const;
const RECAPTCHA_ACTION = "corporate_quote_submit" as const;
const DEFAULT_RECAPTCHA_MIN_SCORE = 0.5;

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
): Promise<{ ok: boolean; score: number | null }> => {
  const secretKey = (import.meta.env.RECAPTCHA_SECRET_KEY as string | undefined)?.trim();
  const minScoreRaw = (import.meta.env.RECAPTCHA_MIN_SCORE as string | undefined)?.trim();
  const minScore = Number(minScoreRaw ?? DEFAULT_RECAPTCHA_MIN_SCORE);

  if (!secretKey) {
    throw new Error("Missing RECAPTCHA_SECRET_KEY");
  }

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      secret: secretKey,
      response: token,
    }),
  });

  if (!response.ok) return { ok: false, score: null };

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    action?: string;
    score?: number;
  } | null;

  const score = typeof payload?.score === "number" ? payload.score : null;
  const scorePassed = score === null ? false : score >= minScore;

  return {
    ok: Boolean(payload?.success) && payload?.action === RECAPTCHA_ACTION && scorePassed,
    score,
  };
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
  const user = (import.meta.env.GMAIL_USER as string | undefined)?.trim();
  const pass = (import.meta.env.GMAIL_APP_PASSWORD as string | undefined)?.trim();
  const leadDestination =
    (import.meta.env.LEAD_DESTINATION_EMAIL as string | undefined)?.trim() ||
    user ||
    DEFAULT_LEAD_DESTINATION_EMAIL;

  if (!user || !pass) {
    throw new Error("Missing GMAIL_USER or GMAIL_APP_PASSWORD");
  }

  return { user, pass, leadDestination };
};

const sendEmailWithGmail = async (options: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}): Promise<void> => {
  const { user, pass } = getMailerConfig();
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

export const POST: APIRoute = async ({ request }) => {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(
      JSON.stringify({
        ok: false,
        message: "No fue posible procesar tu solicitud. Verifica los datos.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const honeypot = getString(formData.get("company_website"));
  if (honeypot) {
    return new Response(
      JSON.stringify({
        ok: true,
        message:
          "Gracias. Tu solicitud fue enviada correctamente. Nuestro equipo comercial dará seguimiento a la brevedad.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const nameCompany = getString(formData.get("name_company"));
  const phone = getString(formData.get("phone"));
  const email = getString(formData.get("email"));
  const consumption = getString(formData.get("consumption"));
  const recaptchaToken = getString(formData.get("g-recaptcha-response"));

  const consumptionLabel = CONSUMPTION_LABELS[consumption] ?? "";
  const safeNameCompany = sanitizeLine(nameCompany);
  const safePhone = sanitizeLine(phone);

  if (!safeNameCompany) {
    return new Response(
      JSON.stringify({ ok: false, message: "Indica tu nombre o empresa." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (safeNameCompany.length > 140) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: "El nombre o empresa es demasiado largo.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!safePhone) {
    return new Response(
      JSON.stringify({ ok: false, message: "Indica un teléfono de contacto." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (safePhone.length > 40) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: "El teléfono es demasiado largo.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!isValidEmail(email)) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: "Revisa el formato del correo electrónico.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!consumptionLabel) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: "Selecciona tu consumo estimado.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!recaptchaToken) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: "Confirma que no eres un robot.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const recaptchaResult = await verifyRecaptchaToken(recaptchaToken);

    if (!recaptchaResult.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: "No fue posible validar reCAPTCHA. Intenta nuevamente.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
  } catch {
    return new Response(
      JSON.stringify({
        ok: false,
        message: "No fue posible validar reCAPTCHA en este momento. Intenta nuevamente.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const { leadDestination } = getMailerConfig();
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
    });
  } catch {
    return new Response(
      JSON.stringify({
        ok: false,
        message:
          "No fue posible enviar tu solicitud en este momento. Intenta nuevamente en unos minutos.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let userConfirmationSent = false;
  if (email) {
    const userSubject = "Recibimos tu solicitud y ya estamos preparando tu cotización | Frío Puro";
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
      });
      userConfirmationSent = true;
    } catch {
      // Complementario: no romper el flujo principal si el lead interno ya salió.
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      message:
        email && userConfirmationSent
          ? "Gracias. Tu solicitud fue enviada correctamente. Nuestro equipo comercial dará seguimiento a la brevedad y te enviaremos confirmación por correo."
          : "Gracias. Tu solicitud fue enviada correctamente. Nuestro equipo comercial dará seguimiento a la brevedad.",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
