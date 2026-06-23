const fs = require("node:fs");
const path = require("node:path");

const keep = Number(process.env.BACKUP_KEEP || "14");
const backupDir = path.resolve(process.env.BACKUP_DIR || "backups");
const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";

function resolveDatabasePath(url) {
  if (!url.startsWith("file:")) {
    throw new Error("backup:sqlite suporta apenas DATABASE_URL com provider SQLite (file:...).");
  }

  const rawPath = url.slice("file:".length);
  if (path.isAbsolute(rawPath)) return rawPath;

  const cwdPath = path.resolve(rawPath);
  if (fs.existsSync(cwdPath)) return cwdPath;

  return path.resolve("prisma", rawPath);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function copyIfExists(source, target) {
  if (!fs.existsSync(source)) return false;
  fs.copyFileSync(source, target);
  return true;
}

function pruneOldBackups() {
  if (!Number.isFinite(keep) || keep <= 0) return;

  const files = fs
    .readdirSync(backupDir)
    .filter((file) => file.endsWith(".db"))
    .map((file) => ({
      file,
      mtime: fs.statSync(path.join(backupDir, file)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const old of files.slice(keep)) {
    fs.rmSync(path.join(backupDir, old.file), { force: true });
    fs.rmSync(path.join(backupDir, `${old.file}-wal`), { force: true });
    fs.rmSync(path.join(backupDir, `${old.file}-shm`), { force: true });
  }
}

function main() {
  const dbPath = resolveDatabasePath(databaseUrl);
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Banco SQLite não encontrado em ${dbPath}`);
  }

  fs.mkdirSync(backupDir, { recursive: true });

  const baseName = `${path.basename(dbPath, ".db")}-${timestamp()}.db`;
  const target = path.join(backupDir, baseName);

  copyIfExists(dbPath, target);
  copyIfExists(`${dbPath}-wal`, `${target}-wal`);
  copyIfExists(`${dbPath}-shm`, `${target}-shm`);
  pruneOldBackups();

  console.log(`Backup criado: ${target}`);
}

main();
