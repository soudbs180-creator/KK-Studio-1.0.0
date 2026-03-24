import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, "..");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .reduce((accumulator, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return accumulator;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        return accumulator;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      accumulator[key] = value;
      return accumulator;
    }, {});
}

function loadLocalEnv() {
  const protectedKeys = new Set(Object.keys(process.env));
  const envFiles = [
    path.join(repoRoot, ".env"),
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, "apps", "api", ".env"),
    path.join(repoRoot, "apps", "api", ".env.local"),
  ];

  for (const filePath of envFiles) {
    const values = parseEnvFile(filePath);
    for (const [key, value] of Object.entries(values)) {
      if (!protectedKeys.has(key)) {
        process.env[key] = value;
      }
    }
  }
}

loadLocalEnv();
process.env.RUN_KK_API_SKELETON = process.env.RUN_KK_API_SKELETON || "true";
process.env.PORT = process.env.PORT || "3001";

const serverEntry = pathToFileURL(path.join(repoRoot, "apps", "api", "src", "server.ts")).href;
await import(serverEntry);
