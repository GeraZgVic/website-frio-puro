export const CORPORATE_QUOTE_PATH = "/cotizacion-corporativa";

export const isCorporateQuotePage = (pathname: string): boolean =>
  pathname === CORPORATE_QUOTE_PATH || pathname === `${CORPORATE_QUOTE_PATH}/`;

export const getQuoteCtaHref = (pathname: string): string =>
  isCorporateQuotePage(pathname)
    ? "#formulario-corporativo"
    : `${CORPORATE_QUOTE_PATH}#formulario-corporativo`;

export const getHomeSectionHref = (pathname: string, id: string): string =>
  isCorporateQuotePage(pathname) ? `/#${id}` : `#${id}`;

export const getLogoHref = (pathname: string): string =>
  isCorporateQuotePage(pathname) ? "/#inicio" : "#inicio";

