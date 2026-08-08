import * as DocumentPicker from "expo-document-picker";
import {
  csvTextToGrid,
  detectImportFormat,
  detectImportMappings,
  parseImportGrid,
  xlsxToGrid,
} from "../domain/services/importParser";

const PICKER_TYPES = [
  "text/csv",
  "text/comma-separated-values",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
  "*/*",
];

/**
 * @param {string} uri
 * @param {'csv'|'xlsx'} format
 */
/**
 * Read a document-picker URI. Uses expo-file-system when possible.
 * Local `fetch(fileUri)` is a device filesystem fallback only — not remote networking.
 * Outbound HTTPS remains isolated to `src/remote/smartTipsClient.js`.
 */
async function readUriAsImportContent(uri, format) {
  if (format === "csv") {
    try {
      const FileSystem = await import("expo-file-system/legacy");
      const text = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      return { kind: "csv", content: text };
    } catch {
      // Local file URI only (document picker cache).
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error("Could not read the selected file.");
      }
      return { kind: "csv", content: await response.text() };
    }
  }

  // Prefer base64 via expo-file-system/legacy for binary xlsx on device.
  try {
    const FileSystem = await import("expo-file-system/legacy");
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { kind: "xlsx", content: base64 };
  } catch {
    // Local file URI only (document picker cache).
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error("Could not read the selected spreadsheet.");
    }
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
    }
    // btoa may be unavailable in some RN builds; fall back to manual base64 if needed.
    const base64 = typeof globalThis.btoa === "function"
      ? globalThis.btoa(binary)
      : Buffer.from(bytes).toString("base64");
    return { kind: "xlsx", content: base64 };
  }
}

/**
 * Open the document picker and parse CSV or XLSX into the shared grid pipeline.
 * @returns {Promise<null | {
 *   fileName: string,
 *   format: 'csv'|'xlsx',
 *   headers: string[],
 *   grid: unknown[][],
 *   mappings: import('../domain/services/importParser').ImportColumnMappings,
 *   preview: import('../domain/services/importParser').ImportParseResult,
 * }>}
 */
export async function pickAndParseImportFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: PICKER_TYPES,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const fileName = asset.name || "import.csv";
  let format = detectImportFormat(fileName);
  if (format === "unknown") {
    const mime = String(asset.mimeType ?? "").toLowerCase();
    if (mime.includes("sheet") || mime.includes("excel")) {
      format = "xlsx";
    } else {
      format = "csv";
    }
  }

  const loaded = await readUriAsImportContent(asset.uri, format);
  const grid = loaded.kind === "xlsx"
    ? xlsxToGrid(loaded.content, "base64")
    : csvTextToGrid(loaded.content);

  if (grid.length === 0) {
    throw new Error("The selected file has no data.");
  }

  const headerCells = (grid[0] ?? []).map((cell) => String(cell ?? "").trim());
  const mappings = detectImportMappings(headerCells);
  const preview = parseImportGrid(grid, mappings);

  return {
    fileName,
    format: loaded.kind,
    headers: preview.headers,
    grid,
    mappings,
    preview,
  };
}

/**
 * Re-parse a loaded grid with user-adjusted column mappings.
 * @param {unknown[][]} grid
 * @param {import('../domain/services/importParser').ImportColumnMappings} mappings
 */
export function parseGridWithMappings(grid, mappings) {
  return parseImportGrid(grid, mappings);
}
