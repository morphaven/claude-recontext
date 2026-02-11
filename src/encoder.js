'use strict';

/**
 * Encode an absolute file path into the format Claude Code uses
 * for project directory names under ~/.claude/projects/
 */
function encodeProjectPath(absolutePath) {
  let p = absolutePath.replace(/\\/g, '/');
  p = p.replace(/:\//, '--');
  p = p.replace(/\//g, '-');
  p = p.replace(/ /g, '-');
  p = p.replace(/\./g, '-');
  let result = '';
  for (const ch of p) {
    result += ch.codePointAt(0) < 128 ? ch : '-';
  }
  return result;
}

module.exports = { encodeProjectPath };
