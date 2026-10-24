/**
 * ISO 4217 numeric → alpha labels for Switch / Cortex / prepaid displays.
 * Unknown codes still fall back to the padded numeric string.
 */
const ISO_CURRENCY_ALPHA: Record<string, string> = {
  // Africa / East Africa
  "230": "ETB",
  "404": "KES",
  "646": "RWF",
  "690": "SCR",
  "706": "SOS",
  "710": "ZAR",
  "728": "SSP",
  "748": "SZL",
  "800": "UGX",
  "834": "TZS",
  "932": "ZWL",
  "943": "MZN",
  "967": "ZMW",
  "968": "SRD",
  "969": "MGA",
  "973": "AOA",
  "976": "CDF",
  "950": "XAF",
  "952": "XOF",
  "953": "XPF",
  // Middle East / Gulf
  "048": "BHD",
  "364": "IRR",
  "368": "IQD",
  "376": "ILS",
  "400": "JOD",
  "414": "KWD",
  "422": "LBP",
  "512": "OMR",
  "634": "QAR",
  "682": "SAR",
  "760": "SYP",
  "784": "AED",
  "886": "YER",
  // Europe
  "008": "ALL",
  "051": "AMD",
  "203": "CZK",
  "208": "DKK",
  "348": "HUF",
  "352": "ISK",
  "428": "LVL",
  "440": "LTL",
  "498": "MDL",
  "578": "NOK",
  "642": "RON",
  "643": "RUB",
  "752": "SEK",
  "756": "CHF",
  "807": "MKD",
  "826": "GBP",
  "941": "RSD",
  "944": "AZN",
  "946": "RON",
  "949": "TRY",
  "975": "BGN",
  "977": "BAM",
  "978": "EUR",
  "980": "UAH",
  "981": "GEL",
  "985": "PLN",
  // Americas
  "032": "ARS",
  "044": "BSD",
  "068": "BOB",
  "124": "CAD",
  "152": "CLP",
  "170": "COP",
  "188": "CRC",
  "214": "DOP",
  "222": "SVC",
  "320": "GTQ",
  "340": "HNL",
  "484": "MXN",
  "558": "NIO",
  "590": "PAB",
  "600": "PYG",
  "604": "PEN",
  "840": "USD",
  "858": "UYU",
  "928": "VES",
  "986": "BRL",
  // Asia / Pacific
  "036": "AUD",
  "050": "BDT",
  "104": "MMK",
  "116": "KHR",
  "144": "LKR",
  "156": "CNY",
  "344": "HKD",
  "356": "INR",
  "360": "IDR",
  "392": "JPY",
  "410": "KRW",
  "417": "KGS",
  "418": "LAK",
  "446": "MOP",
  "458": "MYR",
  "496": "MNT",
  "524": "NPR",
  "554": "NZD",
  "586": "PKR",
  "608": "PHP",
  "702": "SGD",
  "704": "VND",
  "764": "THB",
  "901": "TWD",
  "934": "TMT",
  "972": "TJS",
};

/**
 * Maps numeric currency (e.g. 840, 784) to a short alpha label for operators.
 * Unknown codes fall back to the numeric string.
 */
export function isoCurrencyLabel(
  code: number | string | null | undefined,
): string {
  if (code == null || code === "") return "";
  const key = String(code).trim().replace(/^0+/, "") || "0";
  if (key === "0") return "";
  const padded = key.padStart(3, "0");
  return ISO_CURRENCY_ALPHA[padded] || ISO_CURRENCY_ALPHA[key] || padded;
}

export function formatMoneyWithCurrency(
  amount: number,
  currency: number | string | null | undefined,
): string {
  const money = Number.isFinite(amount)
    ? amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "-";
  const label = isoCurrencyLabel(currency);
  return label ? `${money} ${label}` : money;
}
