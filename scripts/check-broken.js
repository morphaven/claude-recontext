#!/usr/bin/env node
'use strict';

/**
 * SessionStart hook script — checks for broken Claude Code projects.
 * Only uses built-in Node.js modules (no chalk, no npm deps).
 * Outputs a warning to stdout that Claude will see and relay to the user.
 */

const { listProjects } = require('../src/scanner');

async function main() {
  try {
    const projects = await listProjects();
    const broken = projects.filter(p => p.exists === false);

    if (broken.length === 0) return;

    const lines = [`${broken.length} kırık Claude Code projesi tespit edildi:`];
    for (const p of broken) {
      lines.push(`  - ${p.projectPath}`);
    }
    lines.push('');
    lines.push('Düzeltmek için /recontext komutunu kullanın.');

    console.log(lines.join('\n'));
  } catch {
    // Silent — don't block session start on errors
  }
}

main();
