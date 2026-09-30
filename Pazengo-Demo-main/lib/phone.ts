/** Mask a display number, e.g. "082 555 0141" -> "082 ••• 0141". */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "•••••";
  const tail = phone.trim().slice(-4);
  const head = phone.trim().slice(0, 3);
  return `${head} ••• ${tail}`;
}

/** Normalize a display number to wa.me digits: strip non-digits, leading 0 -> 27, drop +. */
export function toWhatsAppDigits(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = `27${d.slice(1)}`;
  return d;
}
