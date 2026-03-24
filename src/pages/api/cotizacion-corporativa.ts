import type { APIRoute } from "astro";

const LEAD_DESTINATION_EMAIL = "soporte@importacionesamexico.com.mx" as const;

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

const sendEmailWithResend = async (options: {
  to: string | string[];
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<void> => {
  const apiKey = import.meta.env.RESEND_API_KEY as string | undefined;
  const from = import.meta.env.RESEND_FROM as string | undefined;

  if (!apiKey || !from) {
    throw new Error("Missing RESEND_API_KEY or RESEND_FROM");
  }

  const to = Array.isArray(options.to) ? options.to : [options.to];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: options.subject,
        text: options.text,
        ...(options.replyTo ? { reply_to: options.replyTo } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Resend request failed (${response.status}): ${body.slice(0, 280)}`,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
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

  const receivedAt = new Date().toISOString();
  const origin = "/cotizacion-corporativa";

  const internalSubject = "Nueva solicitud de cotización corporativa | Frío Puro";
  const internalText = [
    "Nueva solicitud de cotización corporativa",
    "",
    `Nombre / Empresa: ${safeNameCompany}`,
    `Teléfono: ${safePhone}`,
    `Correo electrónico: ${email || "No proporcionado"}`,
    `Consumo estimado: ${consumptionLabel}`,
    `Fecha/hora (UTC): ${receivedAt}`,
    `Origen: ${origin}`,
  ].join("\n");

  try {
    await sendEmailWithResend({
      to: LEAD_DESTINATION_EMAIL,
      subject: internalSubject,
      text: internalText,
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
    const userSubject =
      "Recibimos tu solicitud de cotización corporativa | Frío Puro";
    const userText = [
      "Hola,",
      "",
      "Recibimos tu solicitud de cotización corporativa en Frío Puro.",
      "",
      "Nuestro equipo revisará tu información para dar seguimiento con una propuesta acorde al volumen y operación de tu negocio.",
      "",
      "Resumen de tu solicitud:",
      `- Nombre / Empresa: ${safeNameCompany}`,
      `- Teléfono: ${safePhone}`,
      `- Correo electrónico: ${email}`,
      `- Consumo estimado: ${consumptionLabel}`,
      "",
      "En caso de requerir información adicional, nos pondremos en contacto contigo a la brevedad.",
      "",
      "Atentamente,",
      "Frío Puro",
    ].join("\n");

    try {
      await sendEmailWithResend({
        to: email,
        subject: userSubject,
        text: userText,
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
