import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

// Resolve assets from this script so generation is independent of the caller's working directory.
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const sourcePath = resolve(repositoryRoot, "assets", "icons", "home.svg");
const outputPath = resolve(repositoryRoot, "assets", "splash-icon.png");

// Preserve the exact Figma path geometry while applying MoneyMap's primary launch color.
const sourceSvg = await readFile(sourcePath, "utf8");
const launchSvg = sourceSvg.replaceAll("#6B7572", "#0F6E5C");

// Rasterize once into a transparent, high-resolution PNG for Expo's density-specific generator.
await sharp(Buffer.from(launchSvg), { density: 384 })
  .resize(384, 384, { fit: "contain" })
  .png()
  .toFile(outputPath);
