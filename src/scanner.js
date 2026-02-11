'use strict';

const fs = require('fs/promises');
const path = require('path');
const { PROJECTS_DIR } = require('./utils');

/**
 * Get the real project path from sessions-index.json if available.
 */
async function getProjectPathFromIndex(projectDir) {
  const indexPath = path.join(projectDir, 'sessions-index.json');
  try {
    const data = await fs.readFile(indexPath, 'utf8');
    const json = JSON.parse(data);
    if (json.originalPath) return json.originalPath;
    if (json.entries && json.entries.length > 0) {
      const entry = json.entries[0];
      if (entry.projectPath) return entry.projectPath;
    }
  } catch {}
  return null;
}

/**
 * Best-effort decode: C-- → C:/, rest stays as-is.
 * Fundamentally lossy (dash = / or space or . or non-ASCII).
 */
function decodeProjectName(encoded) {
  return encoded.replace(/^([A-Za-z])--/, '$1:/');
}

/**
 * List all projects with their real or decoded paths.
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
    const realPath = await getProjectPathFromIndex(dirPath);
    projects.push({
      encoded: entry.name,
      dirPath,
      projectPath: realPath || decodeProjectName(entry.name),
      hasRealPath: !!realPath,
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
