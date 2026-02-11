'use strict';

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const readline = require('readline');
const { PROJECTS_DIR } = require('./utils');

/**
 * Get the real project path. Tries (in order):
 * 1. sessions-index.json → originalPath / entries[].projectPath
 * 2. Root JSONL files → cwd field (tries all, not just the first)
 * 3. Session subdirectory JSONL files (UUID dirs one level deep)
 * 4. Subagent JSONL files (UUID/subagents/*.jsonl)
 */
async function detectProjectPath(projectDir) {
  // Try sessions-index.json
  try {
    const data = await fs.readFile(path.join(projectDir, 'sessions-index.json'), 'utf8');
    const json = JSON.parse(data);
    if (json.originalPath) return json.originalPath;
    if (json.entries && json.entries.length > 0) {
      for (const entry of json.entries) {
        if (entry.projectPath) return entry.projectPath;
      }
    }
  } catch {}

  // Try root JSONL files — iterate all until one has cwd
  try {
    const files = await fs.readdir(projectDir);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
    for (const f of jsonlFiles) {
      const cwd = await findCwdInJsonl(path.join(projectDir, f));
      if (cwd) return cwd;
    }
  } catch {}

  // Try JSONL files inside session subdirectories (one level deep)
  try {
    const entries = await fs.readdir(projectDir, { withFileTypes: true });
    const uuidDirs = entries.filter(e => e.isDirectory() && isUUID(e.name));
    for (const dir of uuidDirs) {
      const sessionDir = path.join(projectDir, dir.name);
      // Check JSONL at session level
      try {
        const sessionFiles = await fs.readdir(sessionDir);
        const jsonlFiles = sessionFiles.filter(f => f.endsWith('.jsonl'));
        for (const f of jsonlFiles) {
          const cwd = await findCwdInJsonl(path.join(sessionDir, f));
          if (cwd) return cwd;
        }
      } catch {}
      // Check subagents directory
      const subagentsDir = path.join(sessionDir, 'subagents');
      try {
        const subFiles = await fs.readdir(subagentsDir);
        const jsonlFiles = subFiles.filter(f => f.endsWith('.jsonl'));
        for (const f of jsonlFiles) {
          const cwd = await findCwdInJsonl(path.join(subagentsDir, f));
          if (cwd) return cwd;
        }
      } catch {}
    }
  } catch {}

  return null;
}

/**
 * Check if a string looks like a UUID (session directory name).
 */
function isUUID(name) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name);
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
      exists,
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
