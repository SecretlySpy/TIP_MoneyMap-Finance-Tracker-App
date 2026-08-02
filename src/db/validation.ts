import type { SqlRow } from "./sql";

export class DataIntegrityError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "DataIntegrityError";
  }
}

export function assertSafeInteger(value: number, fieldName: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${fieldName} must be a safe integer.`);
  }
}

export function assertPositiveInteger(value: number, fieldName: string): void {
  assertSafeInteger(value, fieldName);

  if (value <= 0) {
    throw new RangeError(`${fieldName} must be greater than zero.`);
  }
}

export function assertNonNegativeInteger(value: number, fieldName: string): void {
  assertSafeInteger(value, fieldName);

  if (value < 0) {
    throw new RangeError(`${fieldName} must not be negative.`);
  }
}

export function assertNonBlank(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new TypeError(`${fieldName} must not be blank.`);
  }
}

export function assertColorHex(value: string): void {
  if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
    throw new TypeError("colorHex must use the #RRGGBB format.");
  }
}

export function assertMonthYear(value: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new TypeError("monthYear must use the YYYY-MM format with a valid month.");
  }
}

export function assertOneOf<const Value extends string>(
  value: Value,
  allowedValues: readonly Value[],
  fieldName: string,
): void {
  if (!allowedValues.includes(value)) {
    throw new TypeError(`${fieldName} has an unsupported value.`);
  }
}

export function assertPatchHasValues(patch: object): void {
  if (Object.keys(patch).length === 0) {
    throw new TypeError("An update must include at least one field.");
  }
}

export function readInteger(row: SqlRow, columnName: string): number {
  const value = row[columnName];

  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new DataIntegrityError(`${columnName} is not a safe integer.`);
  }

  return value;
}

export function readString(row: SqlRow, columnName: string): string {
  const value = row[columnName];

  if (typeof value !== "string") {
    throw new DataIntegrityError(`${columnName} is not text.`);
  }

  return value;
}

export function readNullableString(row: SqlRow, columnName: string): string | null {
  const value = row[columnName];

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new DataIntegrityError(`${columnName} is not nullable text.`);
  }

  return value;
}

export function readBoolean(row: SqlRow, columnName: string): boolean {
  const value = readInteger(row, columnName);

  if (value !== 0 && value !== 1) {
    throw new DataIntegrityError(`${columnName} is not a SQLite boolean.`);
  }

  return value === 1;
}

export function readEnum<const Value extends string>(
  row: SqlRow,
  columnName: string,
  allowedValues: readonly Value[],
): Value {
  const value = readString(row, columnName);

  if (!allowedValues.some((allowedValue) => allowedValue === value)) {
    throw new DataIntegrityError(`${columnName} contains an unsupported value.`);
  }

  return value as Value;
}
