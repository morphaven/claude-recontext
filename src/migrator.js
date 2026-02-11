'use strict';

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const readline = require('readline');
const { encodeProjectPath } = require('./encoder');
const { normalizePath, PROJECTS_DIR, HISTORY_FILE } = require('./utils');
const { updateSessionsIndex } = require('./sessions');
const { findJsonlFiles, updateJsonlFile } = require('./jsonl');
const { projectDirExists } = require('./scanner');
const ui = require('./ui');

/**
 * Perform migration with rollback support.
 */
async function migrate({ fromPath, toPath, dryRun = false }) {
  const from = normalizePath(fromPath);
  const to = normalizePath(toPath);

  const oldEncoded = encodeProjectPath(from);
  const newEncoded = encodeProjectPath(to);

  const oldDir = path.join(PROJECTS_DIR, oldEncoded);
  const newDir = path.join(PROJECTS_DIR, newEncoded);

  if (!(await projectDirExists(oldEncoded))) {
    throw new Error(
      `Kaynak proje dizini bulunamadı:\n  ${oldDir}\n\n` +
      `"${from}" için kodlanmış dizin: ${oldEncoded}`
    );
  }

  if (await projectDirExists(newEncoded)) {
    throw new Error(
      `Hedef proje dizini zaten mevcut:\n  ${newDir}\n\n` +
      `Üzerine yazma riski nedeniyle işlem iptal edildi.`
    );
  }

  ui.heading('Migrasyon Planı');
  ui.info(`Kaynak: ${from}`);
  ui.info(`Hedef:  ${to}`);
  console.log();
  ui.info(`Eski kodlama: ${oldEncoded}`);
  ui.info(`Yeni kodlama: ${newEncoded}`);
  console.log();

  if (dryRun) {
    ui.dryRunBanner();
    return await dryRunMigration(oldDir, newDir, from);
  }

  const rollback = [];

  try {
    // Step 1: Rename project directory
    ui.heading('Adım 1: Proje dizini yeniden adlandırılıyor');
    await fs.rename(oldDir, newDir);
    rollback.push({ type: 'rename-dir', from: newDir, to: oldDir });
    ui.migration(oldDir, newDir);

    // Step 2: Update sessions-index.json
    ui.heading('Adım 2: sessions-index.json güncelleniyor');
    const sessResult = await updateSessionsIndex(newDir, from, to, oldEncoded, newEncoded);
    if (sessResult.updated) {
      if (sessResult.originalContent) {
        rollback.push({ type: 'file-content', path: sessResult.path, content: sessResult.originalContent });
      }
      ui.fileUpdated(sessResult.path);
    } else {
      ui.info('sessions-index.json bulunamadı veya değişiklik gerekmedi.');
    }

    // Step 3: Update JSONL files in project directory
    ui.heading('Adım 3: JSONL dosyaları güncelleniyor');
    const jsonlFiles = await findJsonlFiles(newDir);
    let jsonlUpdated = 0;
    let totalLines = 0;
    for (const file of jsonlFiles) {
      const result = await updateJsonlFile(file, from, to);
      if (result.updated) {
        jsonlUpdated++;
        totalLines += result.linesChanged;
        ui.fileUpdated(result.path);
      }
    }
    if (jsonlUpdated === 0) {
      ui.info('JSONL dosyalarında değişiklik gerekmedi.');
    } else {
      ui.info(`${jsonlUpdated} dosyada toplam ${totalLines} satır güncellendi.`);
    }

    // Step 4: Update history.jsonl (reuse same JSONL updater)
    ui.heading('Adım 4: history.jsonl güncelleniyor');
    try {
      const histResult = await updateJsonlFile(HISTORY_FILE, from, to);
      if (histResult.updated) {
        ui.fileUpdated(histResult.path);
        ui.info(`${histResult.linesChanged} satır güncellendi.`);
      } else {
        ui.info('history.jsonl değişiklik gerekmedi.');
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        ui.info('history.jsonl bulunamadı.');
      } else {
        throw err;
      }
    }

    // Step 5: Verification (full streaming scan)
    ui.heading('Adım 5: Doğrulama');
    const remaining = await verifyNoOldRefs(newDir, from);
    if (remaining.length === 0) {
      ui.success('Migrasyon başarıyla tamamlandı! Eski path referansı kalmadı.');
    } else {
      ui.warning(`${remaining.length} dosyada eski path referansı bulundu.`);
      for (const f of remaining) {
        console.log(`  ${ui.SYMBOLS.warning} ${f}`);
      }
    }

    return {
      success: true,
      from,
      to,
      oldEncoded,
      newEncoded,
      sessionsUpdated: sessResult.updated,
      jsonlFilesUpdated: jsonlUpdated,
      jsonlLinesChanged: totalLines,
    };
  } catch (err) {
    ui.heading('HATA — Geri alma işlemi başlatılıyor');
    ui.error(err.message);

    for (let i = rollback.length - 1; i >= 0; i--) {
      const action = rollback[i];
      try {
        if (action.type === 'rename-dir') {
          await fs.rename(action.from, action.to);
          ui.success(`Dizin geri alındı: ${action.to}`);
        } else if (action.type === 'file-content') {
          await fs.writeFile(action.path, action.content, 'utf8');
          ui.success(`Dosya geri alındı: ${action.path}`);
        }
      } catch (rollbackErr) {
        ui.error(`Geri alma hatası: ${rollbackErr.message}`);
      }
    }

    throw err;
  }
}

/**
 * Dry-run: show what would change without modifying anything.
 */
async function dryRunMigration(oldDir, newDir, from) {
  const changes = [];

  changes.push({ type: 'rename-dir', from: oldDir, to: newDir });
  ui.info('Dizin yeniden adlandırılacak:');
  ui.migration(oldDir, newDir);

  // Sessions index
  const indexPath = path.join(oldDir, 'sessions-index.json');
  try {
    await fs.access(indexPath);
    changes.push({ type: 'update-file', path: indexPath });
    ui.info('Güncellenecek: sessions-index.json');
  } catch {}

  // JSONL files — full streaming scan
  const jsonlFiles = await findJsonlFiles(oldDir);
  for (const file of jsonlFiles) {
    if (await fileContainsPath(file, from)) {
      changes.push({ type: 'update-file', path: file });
      ui.fileUpdated(file + ' (güncellenecek)');
    }
  }

  // History
  try {
    if (await fileContainsPath(HISTORY_FILE, from)) {
      changes.push({ type: 'update-file', path: HISTORY_FILE });
      ui.info('Güncellenecek: history.jsonl');
    }
  } catch {}

  console.log();
  ui.info(`Toplam ${changes.length} değişiklik yapılacak.`);

  return { dryRun: true, changes };
}

/**
 * Stream-scan a file for any occurrence of oldPath (all variants).
 */
async function fileContainsPath(filePath, oldPath) {
  const terms = buildSearchTerms(oldPath);

  const rl = readline.createInterface({
    input: fsSync.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const lower = line.toLowerCase();
    if (terms.some(t => lower.includes(t))) {
      rl.close();
      return true;
    }
  }
  return false;
}

/**
 * Full streaming verification: check every line for old path refs.
 */
async function verifyNoOldRefs(projectDir, oldPath) {
  const files = await findJsonlFiles(projectDir);
  const sessIndex = path.join(projectDir, 'sessions-index.json');
  try {
    await fs.access(sessIndex);
    files.push(sessIndex);
  } catch {}

  const remaining = [];
  for (const file of files) {
    if (await fileContainsPath(file, oldPath)) {
      remaining.push(file);
    }
  }
  return remaining;
}

function buildSearchTerms(oldPath) {
  const fwd = oldPath.replace(/\\/g, '/').toLowerCase();
  const back = oldPath.replace(/\//g, '\\').toLowerCase();
  const esc = back.replace(/\\/g, '\\\\').toLowerCase();
  return [fwd, back, esc];
}

module.exports = { migrate };
