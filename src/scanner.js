'use strict';

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const readline = require('readline');
const { PROJECTS_DIR } = require('./utils');

/**
 * Get the real project path. Tries (in order):
 * 1. sessions-index.json → originalPath / entries[0].projectPath
 * 2. First .jsonl file → cwd field (streaming, first 20 lines)
 */
async function detectProjectPath(projectDir) {
  // Try sessions-index.json
  try {
    const data = await fs.readFile(path.join(projectDir, 'sessions-index.json'), 'utf8');
    const json = JSON.parse(data);
    if (json.originalPath) return json.originalPath;
    if (json.entries && json.entries.length > 0 && json.entries[0].projectPath) {
      return json.entries[0].projectPath;
    }
  } catch {}

  // Try first JSONL file → scan for cwd
  try {
    const files = await fs.readdir(projectDir);
    const jsonl = files.filter(f => f.endsWith('.jsonl'));
    if (jsonl.length > 0) {
      return await findCwdInJsonl(path.join(projectDir, jsonl[0]));
    }
  } catch {}

  return null;
}

/**
 * Stream first N lines of a JSONL file looking for a cwd field.
 */
async function findCwdInJsonl(filePath) {
  const rl = readline.createInterface({
    input: fsSync.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let lineNum = 0;
  for await (const line of rl) {
    if (++lineNum > 20) break;
    try {
      const obj = JSON.parse(line);
      if (obj.cwd) { rl.close(); return obj.cwd; }
      if (obj.snapshot && obj.snapshot.cwd) { rl.close(); return obj.snapshot.cwd; }
    } catch {}
  }
  return null;
}

/**
 * Best-effort decode: C-- → C:/, rest stays as-is.
 */
function decodeProjectName(encoded) {
  return encoded.replace(/^([A-Za-z])--/, '$1:/');
}

/**
 * List all projects with their real paths and health status.
 */
async function listProjects() {
  let entries;
  try {
    entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  const projects = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirPath = path.join(PROJECTS_DIR, entry.name);
    const realPath = await detectProjectPath(dirPath);

    let exists = null;
    if (realPath) {
      try {
        await fs.access(realPath);
        exists = true;
      } catch {
        exists = false;
      }
    }

    projects.push({
      encoded: entry.name,
      dirPath,
      projectPath: realPath || decodeProjectName(entry.name),
      hasRealPath: !!realPath,
      exists, // true = on disk, false = broken, null = unknown
    });
  }

  return projects;
}

/**
 * Check if a project directory exists for the given encoded name.
 */
async function projectDirExists(encoded) {
  try {
    const stat = await fs.stat(path.join(PROJECTS_DIR, encoded));
    return stat.isDirectory();
  } catch {
    return false;
  }
}

module.exports = { listProjects, projectDirExists };
