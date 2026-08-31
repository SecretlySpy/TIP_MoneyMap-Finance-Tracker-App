function assertMinorUnits(value) {
    if (!Number.isSafeInteger(value)) {
        throw new RangeError("Money values must be safe integers expressed in minor units.");
    }
}
function groupThousands(value) {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
// Formatting is the only boundary where integer minor units become display text.
export function formatMinor(amountMinor, options = {}) {
    assertMinorUnits(amountMinor);
    const { currencySymbol = "₱", showCents = true, sign = "auto" } = options;
    const isNegative = amountMinor < 0;
    const absoluteMinor = Math.abs(amountMinor);
    const cents = absoluteMinor % 100;
    const whole = (absoluteMinor - cents) / 100;
    const prefix = isNegative ? "-" : sign === "always" ? "+" : "";
    const visiblePrefix = sign === "never" ? "" : prefix;
    const decimal = showCents ? `.${cents.toString().padStart(2, "0")}` : "";
    return `${visiblePrefix}${currencySymbol}${groupThousands(whole)}${decimal}`;
}
// Transaction signs come from the domain type; stored amounts remain positive.
export function formatTransactionAmount(amountMinor, type, showCents = true, currencySymbol = "₱") {
    assertMinorUnits(amountMinor);
    if (amountMinor < 0) {
        throw new RangeError("Stored transaction amounts must always be positive.");
    }
    const sign = type === "EXPENSE" ? "-" : "+";
    return `${sign}${formatMinor(amountMinor, { currencySymbol, showCents, sign: "never" })}`;
}
// Decimal keypad text is parsed without floating-point currency arithmetic.
// B4: opening balances may legitimately be negative (a card carrying debt), so the
// caller opts in rather than every amount field silently accepting a minus sign.
export function parseDecimalToMinor(input, options = {}) {
    const normalized = input.trim();
    const { allowNegative = false } = options;
    if (normalized.length === 0) {
        throw new RangeError("Enter a monetary amount.");
    }
    const negative = allowNegative && normalized.startsWith("-");
    const digits = negative ? normalized.slice(1) : normalized;
    if (digits.length === 0 || !/^\d*(?:\.\d{0,2})?$/.test(digits)) {
        throw new RangeError("Enter a monetary amount with at most two decimal places.");
    }
    const [wholeText = "0", centsText = ""] = digits.split(".");
    const whole = Number(wholeText || "0");
    const cents = Number(centsText.padEnd(2, "0") || "0");
    const magnitude = whole * 100 + cents;
    const amountMinor = negative ? -magnitude : magnitude;
    assertMinorUnits(amountMinor);
    return amountMinor;
}
// This finite-state keypad update caps input and preserves at most two decimals.
export function updateMoneyInput(current, key) {
    if (key === "⌫") {
        const shortened = current.slice(0, -1);
        return shortened === "" ? "0" : shortened;
    }
    if (key === ".") {
        return current.includes(".") ? current : `${current}.`;
    }
    if (!/^\d$/.test(key)) {
        return current;
    }
    const decimalIndex = current.indexOf(".");
    if (decimalIndex >= 0 && current.length - decimalIndex > 2) {
        return current;
    }
    const next = current === "0" ? key : `${current}${key}`;
    return next.replace(/^0+(?=\d)/, "").slice(0, 15);
}
