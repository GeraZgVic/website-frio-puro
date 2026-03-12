const whatsappNumberRaw = "+52 921 362 9468" as const;
const whatsappUrlBase = "https://wa.link/zbvkgs" as const;

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
    header: "Pedir por WhatsApp",
    heroPrimary: "Solicitar cotización",
    productsPrimary: "Solicitar cotización por WhatsApp",
    stepsPrimary: "Hacer mi Pedido Ahora",
    finalPrimary: "Escribir por WhatsApp",
  },
  badges: {
    availability247: "Atención y pedidos 24/7",
    service247: "Servicio disponible 24/7 los 365 días",
    whatsapp247: "WhatsApp 24/7",
    operation247: "24/7",
  },
  microcopy: {
    productsCtaNote: "Respuesta directa para cotizaciones, volumen y entregas.",
    stepsContact:
      "Escríbenos por WhatsApp o llámanos. Respondemos en minutos.",
    finalCtaBody:
      "Contáctanos ahora y recibe tu pedido hoy mismo. Atención personalizada para tu negocio los 365 días del año.",
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
  const normalizedMessage = message?.trim();
  if (!normalizedMessage) {
    return commercialContent.whatsappUrlBase;
  }

  const digits = commercialContent.whatsappNumberRaw.replace(/\D/g, "");
  if (!digits) {
    return commercialContent.whatsappUrlBase;
  }

  const encodedMessage = encodeURIComponent(normalizedMessage);
  return `https://wa.me/${digits}?text=${encodedMessage}`;
};

export type CommercialContentData = typeof commercialContent;
export type CommercialCtaKey = keyof CommercialContentData["ctas"];
export type CommercialBadgeKey = keyof CommercialContentData["badges"];
