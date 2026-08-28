import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = path.resolve(import.meta.dirname, "../src");

function existingFile(abs) {
  for (const candidate of [abs, `${abs}.ts`, `${abs}.tsx`, `${abs}/index.ts`]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const hit = existingFile(path.join(SRC, specifier.slice(2)));
    if (hit) return { shortCircuit: true, url: pathToFileURL(hit).href };
  }
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL) {
    const parent = fileURLToPath(context.parentURL);
    const hit = existingFile(path.resolve(path.dirname(parent), specifier));
    if (hit) return { shortCircuit: true, url: pathToFileURL(hit).href };
  }
  return nextResolve(specifier, context);
}
