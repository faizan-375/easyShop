const currencyPattern = /rs\.?|pkr|₨/i;
const compactNumericPattern = /^[0-9]{3,8}(?:\.\d{1,2})?$/;
const commaNumericPattern = /^[0-9]{1,3}(?:[,\s][0-9]{3})+(?:\.\d{1,2})?$/;
const unitSuffixPattern =
  /^(?:gb|tb|mb|kb|mah|hz|mhz|ghz|w|v|mp|inch|inches|cm|mm|kg|g|gen|core|ram|rom|ssd|hdd|bit|gbps|mbps|rpm)\b/i;

function parseBareNumber(value) {
  const trimmed = String(value || "").trim();
  if (!compactNumericPattern.test(trimmed) && !commaNumericPattern.test(trimmed)) return null;
  const number = Number(trimmed.replace(/[\s,]/g, ""));
  return Number.isFinite(number) && number >= 10 && number <= 10000000 ? number : null;
}

export function normalizePrice(value, options = {}) {
  if (!value) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 10 && value <= 10000000 ? value : null;
  }

  const [first] = extractPriceCandidates(value);
  if (first === undefined && options.allowBare !== false) {
    return parseBareNumber(value);
  }

  return first ?? null;
}

export function extractPriceCandidates(value) {
  if (!value) return [];

  const raw = String(value).replace(/\s+/g, " ");
  const matches = [];
  const pattern =
    /(?:(?:rs\.?|pkr|₨)\s*)?([0-9]{1,3}(?:[,\s][0-9]{3})+(?:\.\d{1,2})?|[0-9]{3,8}(?:\.\d{1,2})?)(?:\s*(?:rs\.?|pkr|₨))?/gi;
  const priceWords = /(rs\.?|pkr|₨|price|sale|discount|regular|current|now|only|deal|was|amount|total)/i;
  const nonPriceWords = /(review|rating|sold|order|follower|view|sku|model|capacity|storage|memory|interface|usb|serial)/i;

  for (const match of raw.matchAll(pattern)) {
    const numberText = match[1].replace(/[\s,]/g, "");
    const number = Number(numberText);
    const numberStart = match.index + match[0].indexOf(match[1]);
    const numberEnd = numberStart + match[1].length;
    const beforeNumber = raw[numberStart - 1] || "";
    const afterNumber = raw[numberEnd] || "";
    const afterMatch = raw.slice(match.index + match[0].length, match.index + match[0].length + 14).trimStart();
    const start = Math.max(0, match.index - 24);
    const end = Math.min(raw.length, match.index + match[0].length + 24);
    const context = raw.slice(start, end);
    const hasCurrency = currencyPattern.test(match[0]);

    if (!Number.isFinite(number)) continue;
    if (number < 10 || number > 10000000) continue;
    if (/[a-z0-9]/i.test(beforeNumber) || /[a-z]/i.test(afterNumber)) continue;
    if (unitSuffixPattern.test(afterMatch)) continue;
    if (!hasCurrency && nonPriceWords.test(context)) continue;
    if (!hasCurrency && !priceWords.test(context)) continue;

    matches.push(number);
  }

  return Array.from(new Set(matches)).sort((a, b) => a - b);
}

export function formatPkr(value) {
  if (!Number.isFinite(value)) return "Price unavailable";
  return `Rs. ${Math.round(value).toLocaleString("en-PK")}`;
}
