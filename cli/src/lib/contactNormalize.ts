import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export function normalizeEmailInput(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhoneInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const parsed = parsePhoneNumberFromString(trimmed);
  if (parsed && parsed.isValid()) {
    return parsed.number;
  }

  const digitsWithPlus = trimmed.replace(/[^\d+]/g, "");
  const plusPrefix = digitsWithPlus.startsWith("+") ? "+" : "";
  const digitsOnly = digitsWithPlus.replace(/\+/g, "");
  return `${plusPrefix}${digitsOnly}`;
}

export function isPhoneInputValid(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  const parsed = parsePhoneNumberFromString(trimmed);
  return Boolean(parsed && parsed.isValid());
}
