// ============================================================
// NEUROTEK AI — EU VAT Calculation Engine
// ============================================================

export const EU_VAT_RATES: Record<string, { rate: number; name: string }> = {
  AT: { rate: 0.20, name: 'Austria' },
  BE: { rate: 0.21, name: 'Belgium' },
  BG: { rate: 0.20, name: 'Bulgaria' },
  CY: { rate: 0.19, name: 'Cyprus' },
  CZ: { rate: 0.21, name: 'Czechia' },
  DE: { rate: 0.19, name: 'Germany' },
  DK: { rate: 0.25, name: 'Denmark' },
  EE: { rate: 0.22, name: 'Estonia' },
  ES: { rate: 0.21, name: 'Spain' },
  FI: { rate: 0.25, name: 'Finland' },
  FR: { rate: 0.20, name: 'France' },
  GR: { rate: 0.24, name: 'Greece' },
  HR: { rate: 0.25, name: 'Croatia' },
  HU: { rate: 0.27, name: 'Hungary' },
  IE: { rate: 0.23, name: 'Ireland' },
  IT: { rate: 0.22, name: 'Italy' },
  LT: { rate: 0.21, name: 'Lithuania' },
  LU: { rate: 0.17, name: 'Luxembourg' },
  LV: { rate: 0.21, name: 'Latvia' },
  MT: { rate: 0.18, name: 'Malta' },
  NL: { rate: 0.21, name: 'Netherlands' },
  PL: { rate: 0.23, name: 'Poland' },
  PT: { rate: 0.23, name: 'Portugal' },
  RO: { rate: 0.19, name: 'Romania' },
  SE: { rate: 0.25, name: 'Sweden' },
  SI: { rate: 0.22, name: 'Slovenia' },
  SK: { rate: 0.20, name: 'Slovakia' },
};

export interface VATCalculation {
  countryCode: string;
  vatRate: number;       // e.g. 0.20
  vatRatePct: number;    // e.g. 20
  subtotal: number;      // USD cents
  vatAmount: number;     // USD cents
  total: number;         // USD cents
  isB2B: boolean;
  vatNumber?: string;
  vatNumberValid?: boolean;
}

// ── VAT Number Format Patterns per country ────────────────────
const VAT_PATTERNS: Record<string, RegExp> = {
  AT: /^ATU\d{8}$/,
  BE: /^BE0\d{9}$/,
  BG: /^BG\d{9,10}$/,
  CY: /^CY\d{8}[A-Z]$/,
  CZ: /^CZ\d{8,10}$/,
  DE: /^DE\d{9}$/,
  DK: /^DK\d{8}$/,
  EE: /^EE\d{9}$/,
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
  FI: /^FI\d{8}$/,
  FR: /^FR[A-Z0-9]{2}\d{9}$/,
  GR: /^EL\d{9}$/,
  HR: /^HR\d{11}$/,
  HU: /^HU\d{8}$/,
  IE: /^IE\d[A-Z0-9+*]\d{5}[A-Z]{1,2}$/,
  IT: /^IT\d{11}$/,
  LT: /^LT(\d{9}|\d{12})$/,
  LU: /^LU\d{8}$/,
  LV: /^LV\d{11}$/,
  MT: /^MT\d{8}$/,
  NL: /^NL\d{9}B\d{2}$/,
  PL: /^PL\d{10}$/,
  PT: /^PT\d{9}$/,
  RO: /^RO\d{2,10}$/,
  SE: /^SE\d{12}$/,
  SI: /^SI\d{8}$/,
  SK: /^SK\d{10}$/,
};

// ── Core Functions ────────────────────────────────────────────

export function isEUCountry(countryCode: string): boolean {
  return countryCode.toUpperCase() in EU_VAT_RATES;
}

export function getVATRate(countryCode: string): number {
  return EU_VAT_RATES[countryCode.toUpperCase()]?.rate ?? 0;
}

export function validateVATNumber(vatNumber: string): {
  valid: boolean;
  countryCode: string;
  number: string;
} {
  const cleaned = vatNumber.replace(/\s/g, '').toUpperCase();
  const countryCode = cleaned.slice(0, 2);

  // GB is no longer EU
  if (countryCode === 'GB') {
    return { valid: false, countryCode, number: cleaned };
  }

  const pattern = VAT_PATTERNS[countryCode];
  if (!pattern) {
    return { valid: false, countryCode, number: cleaned };
  }

  const valid = pattern.test(cleaned);
  return { valid, countryCode, number: cleaned };
}

export function calculateVAT(
  subtotalCents: number,
  countryCode: string,
  vatNumber?: string
): VATCalculation {
  const cc = countryCode.toUpperCase();
  const isEU = isEUCountry(cc);

  // Validate VAT number if provided
  let vatNumberValid: boolean | undefined;
  let isB2B = false;

  if (vatNumber && vatNumber.trim() !== '') {
    const result = validateVATNumber(vatNumber);
    vatNumberValid = result.valid;
    isB2B = result.valid; // B2B only if valid VAT number
  }

  // Determine rate
  let vatRate = 0;
  if (isEU && !isB2B) {
    vatRate = getVATRate(cc);
  }
  // Non-EU or B2B reverse charge → 0%

  const vatAmount = Math.round(subtotalCents * vatRate);
  const total = subtotalCents + vatAmount;

  const result: VATCalculation = {
    countryCode: cc,
    vatRate,
    vatRatePct: Math.round(vatRate * 100),
    subtotal: subtotalCents,
    vatAmount,
    total,
    isB2B,
  };

  if (vatNumber) {
    result.vatNumber = vatNumber;
    result.vatNumberValid = vatNumberValid;
  }

  return result;
}

export function formatInvoiceVAT(calc: VATCalculation): string {
  if (calc.vatAmount === 0) {
    if (calc.isB2B) {
      return `VAT 0% (${calc.countryCode}, reverse charge): $0.00`;
    }
    return `VAT 0%: $0.00`;
  }
  const dollars = (calc.vatAmount / 100).toFixed(2);
  const countryName = EU_VAT_RATES[calc.countryCode]?.name ?? calc.countryCode;
  return `VAT ${calc.vatRatePct}% (${countryName}): $${dollars}`;
}
