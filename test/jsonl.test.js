import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { buildSearchTerms, findFiles, findJsonlFiles, updateJsonlFile, updateTextFile } from '../src/jsonl.js';

describe('buildSearchTerms', () => {
  it('should generate forward-slash, backslash, and escaped variants', () => {
    const terms = buildSearchTerms('C:\\Users\\Test\\project');
    expect(terms).toHaveLength(3);
    expect(terms).toContain('c:/users/test/project');      // forward
    expect(terms).toContain('c:\\users\\test\\project');    // backslash
    expect(terms).toContain('c:\\\\users\\\\test\\\\project'); // escaped
  });

  it('should lowercase all terms', () => {
    const terms = buildSearchTerms('C:\\Users\\SteppeEcho\\UPPERCASE');
    for (const t of terms) {
      expect(t).toBe(t.toLowerCase());
    }
  });

  it('should handle forward-slash input', () => {
    const terms = buildSearchTerms('C:/Users/Test/project');
    expect(terms).toContain('c:/users/test/project');
    expect(terms).toContain('c:\\users\\test\\project');
  });
});

describe('findFiles and findJsonlFiles', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'recontext-jsonl-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should find JSONL files recursively', async () => {
    await fs.writeFile(path.join(tmpDir, 'a.jsonl'), '{}');
    await fs.mkdir(path.join(tmpDir, 'sub'));
    await fs.writeFile(path.join(tmpDir, 'sub', 'b.jsonl'), '{}');

    const files = await findJsonlFiles(tmpDir);
    expect(files).toHaveLength(2);
    expect(files.some(f => f.endsWith('a.jsonl'))).toBe(true);
    expect(files.some(f => f.endsWith('b.jsonl'))).toBe(true);
  });

  it('should find files by multiple extensions', async () => {
    await fs.writeFile(path.join(tmpDir, 'readme.md'), '# test');
    await fs.writeFile(path.join(tmpDir, 'data.jsonl'), '{}');
    await fs.writeFile(path.join(tmpDir, 'style.css'), 'body{}');

    const mdFiles = await findFiles(tmpDir, ['.md']);
    expect(mdFiles).toHaveLength(1);

    const mixed = await findFiles(tmpDir, ['.md', '.jsonl']);
    expect(mixed).toHaveLength(2);
  });

  it('should return empty array for non-existent directory', async () => {
    const files = await findFiles(path.join(tmpDir, 'nonexistent'), ['.jsonl']);
    expect(files).toHaveLength(0);
  });
});

describe('updateJsonlFile', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'recontext-update-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should replace paths in JSONL lines', async () => {
    const filePath = path.join(tmpDir, 'session.jsonl');
    const lines = [
      '{"cwd":"C:\\\\Users\\\\Old\\\\project","type":"user"}',
      '{"type":"assistant","message":"hello"}',
      '{"cwd":"C:\\\\Users\\\\Old\\\\project","type":"user"}',
    ];
    await fs.writeFile(filePath, lines.join('\n') + '\n');

    const result = await updateJsonlFile(
      filePath,
      'C:\\Users\\Old\\project',
      'C:\\Users\\New\\project'
    );

    expect(result.updated).toBe(true);
    expect(result.linesChanged).toBe(2);

    const content = await fs.readFile(filePath, 'utf8');
    expect(content).toContain('C:\\\\Users\\\\New\\\\project');
    expect(content).not.toContain('C:\\\\Users\\\\Old\\\\project');
  });

  it('should not modify file if no matches found', async () => {
    const filePath = path.join(tmpDir, 'session.jsonl');
    const content = '{"type":"user","message":"hello"}\n{"type":"assistant","message":"world"}\n';
    await fs.writeFile(filePath, content);

    const result = await updateJsonlFile(filePath, 'C:\\nonexistent', 'C:\\new');
    expect(result.updated).toBe(false);
    expect(result.linesChanged).toBe(0);
  });

  it('should handle forward-slash paths in JSON', async () => {
    const filePath = path.join(tmpDir, 'session.jsonl');
    await fs.writeFile(filePath, '{"path":"C:/Users/Old/project/file.js"}\n');

    const result = await updateJsonlFile(
      filePath,
      'C:\\Users\\Old\\project',
      'C:\\Users\\New\\project'
    );

    expect(result.updated).toBe(true);
    const content = await fs.readFile(filePath, 'utf8');
    expect(content).toContain('C:/Users/New/project');
  });
});

describe('updateTextFile', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'recontext-text-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should replace paths in markdown files', async () => {
    const filePath = path.join(tmpDir, 'MEMORY.md');
    await fs.writeFile(filePath, '# Project at C:\\Users\\Old\\project\n\nSome notes.\n');

    const result = await updateTextFile(
      filePath,
      'C:\\Users\\Old\\project',
      'C:\\Users\\New\\project'
    );

    expect(result.updated).toBe(true);
    const content = await fs.readFile(filePath, 'utf8');
    expect(content).toContain('C:\\Users\\New\\project');
    expect(content).not.toContain('C:\\Users\\Old\\project');
  });

  it('should return original content for rollback', async () => {
    const filePath = path.join(tmpDir, 'test.md');
    const original = '# Old path: C:\\Users\\Old\\project\n';
    await fs.writeFile(filePath, original);

    const result = await updateTextFile(
      filePath,
      'C:\\Users\\Old\\project',
      'C:\\Users\\New\\project'
    );

    expect(result.updated).toBe(true);
    expect(result.originalContent).toBe(original);
  });

  it('should not modify file if no matches', async () => {
    const filePath = path.join(tmpDir, 'test.md');
    await fs.writeFile(filePath, '# No paths here\n');

    const result = await updateTextFile(filePath, 'C:\\nonexistent', 'C:\\new');
    expect(result.updated).toBe(false);
  });
});
