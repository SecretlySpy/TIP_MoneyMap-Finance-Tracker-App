import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const roots = ["src", "App.tsx", "__tests__", "plugins", "__mocks__"];
const workspace = process.cwd();

/** @param {string} dir */
function walk(dir) {
  /** @type {string[]} */
  const files = [];
  if (!fs.existsSync(dir)) {
    return files;
  }
  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    if (/\.tsx?$/.test(dir)) {
      files.push(dir);
    }
    return files;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "android" || entry.name === "ios") {
      continue;
    }
    files.push(...walk(path.join(dir, entry.name)));
  }
  return files;
}

/** @param {string} sourcePath */
function convertFile(sourcePath) {
  const source = fs.readFileSync(sourcePath, "utf8");
  const isTsx = sourcePath.endsWith(".tsx");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2021,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.Preserve,
      esModuleInterop: true,
      importHelpers: false,
      removeComments: false,
      verbatimModuleSyntax: false,
    },
    fileName: sourcePath,
    reportDiagnostics: true,
  });

  if (result.diagnostics?.length) {
    for (const diagnostic of result.diagnostics) {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
      console.warn(`[transpile warn] ${sourcePath}: ${message}`);
    }
  }

  let output = result.outputText
    // Drop pure type-only import leftovers that tsc may leave empty.
    .replace(/^import\s*\{\s*\}\s*from\s*["'][^"']+["'];?\s*$/gm, "")
    // Normalize double blank lines.
    .replace(/\n{3,}/g, "\n\n");

  // Rewrite relative imports/exports that still mention .ts/.tsx extensions (rare).
  output = output.replace(/(from\s+["'][^"']+)\.tsx?(["'])/g, "$1.js$2");

  const outPath = sourcePath.replace(/\.tsx$/, ".jsx").replace(/\.ts$/, ".js");
  fs.writeFileSync(outPath, output, "utf8");
  if (outPath !== sourcePath) {
    fs.unlinkSync(sourcePath);
  }
  console.log(`${path.relative(workspace, sourcePath)} -> ${path.relative(workspace, outPath)}`);
}

const files = roots.flatMap((root) => walk(path.join(workspace, root)));
if (files.length === 0) {
  console.error("No TypeScript files found.");
  process.exit(1);
}

for (const file of files) {
  convertFile(file);
}

console.log(`Converted ${files.length} files.`);
