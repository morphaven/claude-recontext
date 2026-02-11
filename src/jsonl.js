'use strict';

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const readline = require('readline');
const { replacePath, atomicWrite } = require('./utils');

/**
 * Find files by extension in a directory (recursive).
 */
async function findFiles(dir, extensions) {
  const results = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...await findFiles(fullPath, extensions));
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  } catch {}
  return results;
}

async function findJsonlFiles(dir) {
  return findFiles(dir, ['.jsonl']);
}

/**
 * Update a JSONL file, replacing old path references with new ones.
 * Uses streaming to handle large files (300+ MB).
 * Fast path: lines not containing oldPath string are written as-is.
 */
async function updateJsonlFile(filePath, oldPath, newPath) {
  const searchTerms = buildSearchTerms(oldPath);
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
      if (!searchTerms.some(term => lineLower.includes(term))) {
        writeStream.write(line + '\n');
        continue;
      }

      try {
        const obj = JSON.parse(line);
        const newLine = JSON.stringify(deepReplacePaths(obj, oldPath, newPath));
        if (newLine !== line) { linesChanged++; hasChanges = true; }
        writeStream.write(newLine + '\n');
      } catch {
        const newLine = replacePath(line, oldPath, newPath);
        if (newLine !== line) { linesChanged++; hasChanges = true; }
        writeStream.write(newLine + '\n');
      }
    }

    await new Promise((resolve, reject) => {
      writeStream.end(() => resolve());
      writeStream.on('error', reject);
    });

    if (hasChanges) {
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
 * Update a text file (e.g. .md), replacing old path references.
 * For small files — reads entirely into memory.
 */
async function updateTextFile(filePath, oldPath, newPath) {
  const content = await fs.readFile(filePath, 'utf8');
  const updated = replacePath(content, oldPath, newPath);
  if (updated === content) return { updated: false, path: filePath };
  await atomicWrite(filePath, updated);
  return { updated: true, path: filePath, originalContent: content };
}

function deepReplacePaths(obj, oldPath, newPath) {
  if (typeof obj === 'string') return replacePath(obj, oldPath, newPath);
  if (Array.isArray(obj)) return obj.map(item => deepReplacePaths(item, oldPath, newPath));
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepReplacePaths(value, oldPath, newPath);
    }
    return result;
  }
  return obj;
}

function buildSearchTerms(oldPath) {
  const fwd = oldPath.replace(/\\/g, '/').toLowerCase();
  const back = oldPath.replace(/\//g, '\\').toLowerCase();
  const esc = back.replace(/\\/g, '\\\\').toLowerCase();
  return [fwd, back, esc];
}

module.exports = { findFiles, findJsonlFiles, updateJsonlFile, updateTextFile, buildSearchTerms };
