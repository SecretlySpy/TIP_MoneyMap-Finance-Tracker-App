import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

// Resolve assets from this script so generation is independent of the caller's working directory.
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const sourcePath = resolve(repositoryRoot, "assets", "icons", "app-icon-donut.svg");
const outputPath = resolve(repositoryRoot, "assets", "splash-icon.png");

// Rasterize the canonical Donut Mark into high-resolution transparent PNG for Expo's splash and launcher icon.
const sourceSvg = await readFile(sourcePath, "utf8");
const transparentSvg = sourceSvg.replace(/<rect[^>]*fill="#E7F6F1"[^>]*\/>\s*/i, "");
await sharp(Buffer.from(transparentSvg), { density: 384 })
  .resize(384, 384, { fit: "contain" })
  .png()
  .toFile(outputPath);

