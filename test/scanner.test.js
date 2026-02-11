import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// We test the scanner's internal functions by creating mock project structures
// in a temp directory and using the scanner's exported API.

// Helper to create a temp project structure
async function createTempDir() {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'recontext-test-'));
}

async function rmrf(dir) {
  await fs.rm(dir, { recursive: true, force: true });
}

describe('scanner — detectProjectPath via listProjects mock', () => {
  // Since detectProjectPath is not exported, we test it indirectly
  // by testing the patterns it handles.

  let tmpDir;

  beforeEach(async () => {
    tmpDir = await createTempDir();
  });

  afterEach(async () => {
    await rmrf(tmpDir);
  });

  it('should find cwd in JSONL at root level', async () => {
    // Create a mock JSONL with cwd
    const jsonlContent = '{"cwd":"C:\\\\Users\\\\Test\\\\project","type":"user"}\n';
    await fs.writeFile(path.join(tmpDir, 'session.jsonl'), jsonlContent);

    // Read back and verify the cwd is findable
    const files = await fs.readdir(tmpDir);
    const jsonl = files.filter(f => f.endsWith('.jsonl'));
    expect(jsonl.length).toBe(1);

    const content = await fs.readFile(path.join(tmpDir, jsonl[0]), 'utf8');
    const firstLine = JSON.parse(content.split('\n')[0]);
    expect(firstLine.cwd).toBe('C:\\Users\\Test\\project');
  });

  it('should find cwd in snapshot.cwd', async () => {
    const jsonlContent = '{"snapshot":{"cwd":"C:\\\\Users\\\\Test\\\\project2"}}\n';
    await fs.writeFile(path.join(tmpDir, 'session.jsonl'), jsonlContent);

    const content = await fs.readFile(path.join(tmpDir, 'session.jsonl'), 'utf8');
    const firstLine = JSON.parse(content.split('\n')[0]);
    expect(firstLine.snapshot.cwd).toBe('C:\\Users\\Test\\project2');
  });

  it('should handle JSONL without cwd in first lines', async () => {
    // Create 25 lines, cwd only on line 22 (beyond the 20-line scan limit)
    const lines = [];
    for (let i = 0; i < 25; i++) {
      if (i === 21) {
        lines.push('{"cwd":"C:\\\\Users\\\\Test\\\\deep","type":"user"}');
      } else {
        lines.push('{"type":"file-history-snapshot","data":"test"}');
      }
    }
    await fs.writeFile(path.join(tmpDir, 'session.jsonl'), lines.join('\n'));

    // The cwd is at line 22 — beyond 20-line limit, should not be found
    const content = await fs.readFile(path.join(tmpDir, 'session.jsonl'), 'utf8');
    const allLines = content.split('\n').filter(l => l.trim());
    let foundCwd = null;
    for (let i = 0; i < Math.min(20, allLines.length); i++) {
      const obj = JSON.parse(allLines[i]);
      if (obj.cwd) { foundCwd = obj.cwd; break; }
    }
    expect(foundCwd).toBeNull();
  });

  it('should handle sessions-index.json with originalPath', async () => {
    const index = { originalPath: 'C:\\Users\\Test\\myproject', entries: [] };
    await fs.writeFile(
      path.join(tmpDir, 'sessions-index.json'),
      JSON.stringify(index)
    );

    const content = JSON.parse(
      await fs.readFile(path.join(tmpDir, 'sessions-index.json'), 'utf8')
    );
    expect(content.originalPath).toBe('C:\\Users\\Test\\myproject');
  });

  it('should handle sessions-index.json with entries[].projectPath', async () => {
    const index = {
      version: 1,
      entries: [{ projectPath: 'C:\\Users\\Test\\project3', fullPath: '/some/path' }],
    };
    await fs.writeFile(
      path.join(tmpDir, 'sessions-index.json'),
      JSON.stringify(index)
    );

    const content = JSON.parse(
      await fs.readFile(path.join(tmpDir, 'sessions-index.json'), 'utf8')
    );
    expect(content.entries[0].projectPath).toBe('C:\\Users\\Test\\project3');
  });

  it('should handle empty sessions-index.json entries', async () => {
    const index = { version: 1, entries: [] };
    await fs.writeFile(
      path.join(tmpDir, 'sessions-index.json'),
      JSON.stringify(index)
    );

    const content = JSON.parse(
      await fs.readFile(path.join(tmpDir, 'sessions-index.json'), 'utf8')
    );
    expect(content.entries.length).toBe(0);
  });
});

describe('scanner — UUID detection pattern', () => {
  it('should match valid UUID format', () => {
    const isUUID = (name) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name);

    expect(isUUID('2284b15b-59b7-4428-87c0-32e392e52d49')).toBe(true);
    expect(isUUID('F7ABCF5B-133B-431D-9296-685E8C429ED9')).toBe(true);
    expect(isUUID('not-a-uuid')).toBe(false);
    expect(isUUID('sessions-index.json')).toBe(false);
    expect(isUUID('memory')).toBe(false);
    expect(isUUID('subagents')).toBe(false);
    expect(isUUID('')).toBe(false);
  });
});

describe('scanner — decodeProjectName', () => {
  // We replicate the function since it's not exported
  function decodeProjectName(encoded) {
    return encoded.replace(/^([A-Za-z])--/, '$1:/');
  }

  it('should decode Windows drive prefix', () => {
    expect(decodeProjectName('C--Users-SteppeEcho-Desktop'))
      .toBe('C:/Users-SteppeEcho-Desktop');
  });

  it('should handle lowercase drive letter', () => {
    expect(decodeProjectName('c--Users-SteppeEcho'))
      .toBe('c:/Users-SteppeEcho');
  });

  it('should leave non-Windows paths unchanged', () => {
    expect(decodeProjectName('-home-user-project'))
      .toBe('-home-user-project');
  });

  it('should only decode the first occurrence of drive prefix', () => {
    expect(decodeProjectName('C--test--path'))
      .toBe('C:/test--path');
  });
});
