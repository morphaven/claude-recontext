'use strict';

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const readline = require('readline');
const { replacePath, atomicWrite } = require('./utils');

/**
 * Find all .jsonl files in a directory (recursive).
 */
async function findJsonlFiles(dir) {
  const results = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = await findJsonlFiles(fullPath);
        results.push(...sub);
      } else if (entry.name.endsWith('.jsonl')) {
        results.push(fullPath);
      }
    }
  } catch {}
  return results;
}

/**
 * Update a JSONL file, replacing old path references with new ones.
 * Uses streaming to handle large files (300+ MB).
 *
 * Fast path: lines not containing oldPath string are written as-is.
 *
 * Returns { updated: boolean, path: string, linesChanged: number }
 */
async function updateJsonlFile(filePath, oldPath, newPath) {
  const oldFwd = oldPath.replace(/\\/g, '/');
  const oldBack = oldPath.replace(/\//g, '\\');
  const oldEsc = oldBack.replace(/\\/g, '\\\\');

  const searchTerms = [oldFwd, oldBack, oldEsc].map(s => s.toLowerCase());

  const tmpPath = filePath + '.tmp.' + Date.now();
  const writeStream = fsSync.createWriteStream(tmpPath, { encoding: 'utf8' });

  let linesChanged = 0;
  let hasChanges = false;

  try {
    const rl = readline.createInterface({
      input: fsSync.createReadStream(filePath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      const lineLower = line.toLowerCase();
      const containsOld = searchTerms.some(term => lineLower.includes(term));

      if (!containsOld) {
        writeStream.write(line + '\n');
        continue;
      }

      // Line contains old path — parse, update, re-serialize
      try {
        const obj = JSON.parse(line);
        const updated = deepReplacePaths(obj, oldPath, newPath);
        const newLine = JSON.stringify(updated);
        if (newLine !== line) {
          linesChanged++;
          hasChanges = true;
        }
        writeStream.write(newLine + '\n');
      } catch {
        // Not valid JSON, write as-is but still do string replacement
        const newLine = replacePath(line, oldPath, newPath);
        if (newLine !== line) {
          linesChanged++;
          hasChanges = true;
        }
        writeStream.write(newLine + '\n');
      }
    }

    await new Promise((resolve, reject) => {
      writeStream.end(() => resolve());
      writeStream.on('error', reject);
    });

    if (hasChanges) {
      // Atomic swap
      if (process.platform === 'win32') {
        try { await fs.unlink(filePath); } catch {}
      }
      await fs.rename(tmpPath, filePath);
      return { updated: true, path: filePath, linesChanged };
    } else {
      await fs.unlink(tmpPath);
      return { updated: false, path: filePath, linesChanged: 0 };
    }
  } catch (err) {
    try { await fs.unlink(tmpPath); } catch {}
    throw err;
  }
}

/**
 * Deep-replace path strings in an object.
 */
function deepReplacePaths(obj, oldPath, newPath) {
  if (typeof obj === 'string') {
    return replacePath(obj, oldPath, newPath);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => deepReplacePaths(item, oldPath, newPath));
  }
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepReplacePaths(value, oldPath, newPath);
    }
    return result;
  }
  return obj;
}

module.exports = { findJsonlFiles, updateJsonlFile };
