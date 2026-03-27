const whatsappNumberRaw = "+52 921 362 9468" as const;
const whatsappNumberE164 = "5219213629468" as const;
const whatsappUrlBase = "https://api.whatsapp.com/send" as const;

type CommercialContent = {
  whatsappNumberRaw: string;
  whatsappUrlBase: string;
  whatsappMessages: {
    generalInquiry: string;
    quoteIceTube: string;
  };
  ctas: {
    header: string;
    heroPrimary: string;
    productsPrimary: string;
    stepsPrimary: string;
    finalPrimary: string;
  };
  badges: {
    availability247: string;
    service247: string;
    whatsapp247: string;
    operation247: string;
  };
  microcopy: {
    productsCtaNote: string;
    stepsContact: string;
    finalCtaBody: string;
  };
  aria: {
    quoteIceTube: string;
  };
  hours: {
    long: string;
    short: string;
  };
};

export const commercialContent = {
  whatsappNumberRaw,
  whatsappUrlBase,
  whatsappMessages: {
    generalInquiry: "Hola, quiero información sobre hielo para mi negocio.",
    quoteIceTube: "Hola, quiero cotizar hielo en tubo para mi negocio.",
  },
  ctas: {
    header: "Cotizar",
    heroPrimary: "Solicitar cotización",
    productsPrimary: "Solicitar plan de suministro",
    stepsPrimary: "Solicitar plan de entregas",
    finalPrimary: "Hablar con un asesor comercial",
  },
  badges: {
    availability247: "Atención y coordinación 24/7",
    service247: "Servicio disponible 24/7 los 365 días",
    whatsapp247: "WhatsApp 24/7",
    operation247: "24/7",
  },
  microcopy: {
    productsCtaNote: "Respuesta directa para cotizaciones, volumen y entregas.",
    stepsContact: "Comunícate por WhatsApp o llámanos. Respondemos en minutos.",
    finalCtaBody:
      "Atención corporativa y logística de entrega programadas para alta demanda.",
  },
  aria: {
    quoteIceTube: "Cotizar hielo en tubo por WhatsApp",
  },
  hours: {
    long: "Lunes a Domingo · 24/7",
    short: "Lun–Dom 24/7",
  },
} as const satisfies CommercialContent;

export const buildWhatsAppUrl = (message?: string): string => {
  const text =
    message ??
    "Hola, me interesa conocer sus planes de suministro de hielo para mi negocio.";
  return `${commercialContent.whatsappUrlBase}?phone=${whatsappNumberE164}&text=${encodeURIComponent(text)}`;
};

export type CommercialContentData = typeof commercialContent;
export type CommercialCtaKey = keyof CommercialContentData["ctas"];
export type CommercialBadgeKey = keyof CommercialContentData["badges"];
