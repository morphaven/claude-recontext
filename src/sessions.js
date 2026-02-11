'use strict';

const fs = require('fs/promises');
const path = require('path');
const { replacePath, atomicWrite } = require('./utils');

/**
 * Update sessions-index.json in a project directory.
 * Replaces old path references with new ones.
 *
 * Returns { updated: boolean, path: string }
 */
async function updateSessionsIndex(projectDir, oldPath, newPath, oldEncoded, newEncoded) {
  const indexPath = path.join(projectDir, 'sessions-index.json');

  let data;
  try {
    data = await fs.readFile(indexPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { updated: false, path: indexPath };
    throw err;
  }

  const original = data;
  let json;
  try {
    json = JSON.parse(data);
  } catch {
    return { updated: false, path: indexPath };
  }

  // Update originalPath
  if (json.originalPath) {
    json.originalPath = replacePath(json.originalPath, oldPath, newPath);
  }

  // Update entries
  if (Array.isArray(json.entries)) {
    for (const entry of json.entries) {
      if (entry.projectPath) {
        entry.projectPath = replacePath(entry.projectPath, oldPath, newPath);
      }
      if (entry.fullPath) {
        entry.fullPath = replacePath(entry.fullPath, oldEncoded, newEncoded);
      }
    }
  }

  const newData = JSON.stringify(json, null, 2) + '\n';
  if (newData === original) return { updated: false, path: indexPath };

  await atomicWrite(indexPath, newData);
  return { updated: true, path: indexPath, originalContent: original };
}

module.exports = { updateSessionsIndex };
