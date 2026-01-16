export function normaliseAUMobile(input?: string | null): string | null {
  if (!input) return null;

  const digits = input.replace(/\D+/g, "");

  // Handle +61 / 61 / 0 prefixes for AU mobiles
  // Accept common formats: 04xxxxxxxx, 4xxxxxxxx, 614xxxxxxxx, +614xxxxxxxx
  if (digits.startsWith("61") && digits.length === 11) {
    const rest = digits.slice(2); // 4xxxxxxxxx
    return rest.startsWith("4") ? `0${rest}` : null;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return digits.startsWith("04") ? digits : null;
  }

  if (digits.length === 9 && digits.startsWith("4")) {
    return `0${digits}`;
  }

  return null;
}
