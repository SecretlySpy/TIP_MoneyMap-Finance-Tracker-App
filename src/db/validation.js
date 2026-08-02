export class DataIntegrityError extends Error {
    constructor(message) {
        super(message);
        this.name = "DataIntegrityError";
    }
}
export function assertSafeInteger(value, fieldName) {
    if (!Number.isSafeInteger(value)) {
        throw new RangeError(`${fieldName} must be a safe integer.`);
    }
}
export function assertPositiveInteger(value, fieldName) {
    assertSafeInteger(value, fieldName);
    if (value <= 0) {
        throw new RangeError(`${fieldName} must be greater than zero.`);
    }
}
export function assertNonNegativeInteger(value, fieldName) {
    assertSafeInteger(value, fieldName);
    if (value < 0) {
        throw new RangeError(`${fieldName} must not be negative.`);
    }
}
export function assertNonBlank(value, fieldName) {
    if (value.trim().length === 0) {
        throw new TypeError(`${fieldName} must not be blank.`);
    }
}
export function assertColorHex(value) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
        throw new TypeError("colorHex must use the #RRGGBB format.");
    }
}
export function assertMonthYear(value) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
        throw new TypeError("monthYear must use the YYYY-MM format with a valid month.");
    }
}
export function assertOneOf(value, allowedValues, fieldName) {
    if (!allowedValues.includes(value)) {
        throw new TypeError(`${fieldName} has an unsupported value.`);
    }
}
export function assertPatchHasValues(patch) {
    if (Object.keys(patch).length === 0) {
        throw new TypeError("An update must include at least one field.");
    }
}
export function readInteger(row, columnName) {
    const value = row[columnName];
    if (typeof value !== "number" || !Number.isSafeInteger(value)) {
        throw new DataIntegrityError(`${columnName} is not a safe integer.`);
    }
    return value;
}
export function readString(row, columnName) {
    const value = row[columnName];
    if (typeof value !== "string") {
        throw new DataIntegrityError(`${columnName} is not text.`);
    }
    return value;
}
export function readNullableString(row, columnName) {
    const value = row[columnName];
    if (value === null) {
        return null;
    }
    if (typeof value !== "string") {
        throw new DataIntegrityError(`${columnName} is not nullable text.`);
    }
    return value;
}
export function readBoolean(row, columnName) {
    const value = readInteger(row, columnName);
    if (value !== 0 && value !== 1) {
        throw new DataIntegrityError(`${columnName} is not a SQLite boolean.`);
    }
    return value === 1;
}
export function readEnum(row, columnName, allowedValues) {
    const value = readString(row, columnName);
    if (!allowedValues.some((allowedValue) => allowedValue === value)) {
        throw new DataIntegrityError(`${columnName} contains an unsupported value.`);
    }
    return value;
}
