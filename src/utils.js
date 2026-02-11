'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs/promises');

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const HISTORY_FILE = path.join(CLAUDE_DIR, 'history.jsonl');

function normalizePath(p) {
  return path.resolve(p);
}

/**
 * Replace all occurrences of oldPath with newPath in a string.
 * Handles forward-slash, backslash, and JSON-escaped backslash variants.
 * Case-insensitive on Windows.
 */
function replacePath(value, oldPath, newPath) {
  if (typeof value !== 'string') return value;

  const oldFwd = oldPath.replace(/\\/g, '/');
  const newFwd = newPath.replace(/\\/g, '/');
  const oldBack = oldPath.replace(/\//g, '\\');
  const newBack = newPath.replace(/\//g, '\\');
  const oldEsc = oldBack.replace(/\\/g, '\\\\');
  const newEsc = newBack.replace(/\\/g, '\\\\');

  let result = value;
  result = replaceAllCI(result, oldFwd, newFwd);
  result = replaceAllCI(result, oldBack, newBack);
  result = replaceAllCI(result, oldEsc, newEsc);
  return result;
}

function replaceAllCI(str, search, replacement) {
  if (!search) return str;
  const lowerStr = str.toLowerCase();
  const lowerSearch = search.toLowerCase();
  let result = '';
  let lastIndex = 0;
  let index = lowerStr.indexOf(lowerSearch, lastIndex);
  while (index !== -1) {
    result += str.slice(lastIndex, index) + replacement;
    lastIndex = index + search.length;
    index = lowerStr.indexOf(lowerSearch, lastIndex);
  }
  result += str.slice(lastIndex);
  return result;
}

/**
 * Atomic file write: write to temp then rename.
 * On Windows, unlink target first since rename can't overwrite.
 */
async function atomicWrite(targetPath, content) {
  const tmpPath = targetPath + '.tmp.' + Date.now();
  await fs.writeFile(tmpPath, content, 'utf8');
  try {
    if (process.platform === 'win32') {
      try { await fs.unlink(targetPath); } catch {}
    }
    await fs.rename(tmpPath, targetPath);
  } catch (err) {
    try { await fs.unlink(tmpPath); } catch {}
    throw err;
  }
}

module.exports = {
  CLAUDE_DIR,
  PROJECTS_DIR,
  HISTORY_FILE,
  normalizePath,
  replacePath,
  replaceAllCI,
  atomicWrite,
};
