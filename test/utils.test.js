import { describe, it, expect } from 'vitest';
import { replacePath, replaceAllCI } from '../src/utils.js';

describe('replaceAllCI', () => {
  it('should replace case-insensitively', () => {
    expect(replaceAllCI('Hello World', 'hello', 'hi')).toBe('hi World');
  });

  it('should replace all occurrences', () => {
    expect(replaceAllCI('aaa bbb aaa', 'aaa', 'ccc')).toBe('ccc bbb ccc');
  });

  it('should return original if no match', () => {
    expect(replaceAllCI('hello', 'xyz', 'abc')).toBe('hello');
  });

  it('should handle empty search', () => {
    expect(replaceAllCI('hello', '', 'abc')).toBe('hello');
  });

  it('should handle mixed case replacements', () => {
    expect(replaceAllCI('C:\\Users\\test', 'c:\\users', 'D:\\People')).toBe('D:\\People\\test');
  });
});

describe('replacePath', () => {
  it('should replace forward-slash paths', () => {
    const result = replacePath(
      'cwd: C:/Users/Test/old-project',
      'C:\\Users\\Test\\old-project',
      'C:\\Users\\Test\\new-project'
    );
    expect(result).toBe('cwd: C:/Users/Test/new-project');
  });

  it('should replace backslash paths', () => {
    const result = replacePath(
      'cwd: C:\\Users\\Test\\old-project',
      'C:\\Users\\Test\\old-project',
      'C:\\Users\\Test\\new-project'
    );
    expect(result).toBe('cwd: C:\\Users\\Test\\new-project');
  });

  it('should replace JSON-escaped backslash paths', () => {
    const result = replacePath(
      '"cwd":"C:\\\\Users\\\\Test\\\\old-project"',
      'C:\\Users\\Test\\old-project',
      'C:\\Users\\Test\\new-project'
    );
    expect(result).toBe('"cwd":"C:\\\\Users\\\\Test\\\\new-project"');
  });

  it('should be case-insensitive on path drive letter', () => {
    const result = replacePath(
      'c:/users/test/old',
      'C:\\Users\\Test\\old',
      'D:\\New\\path'
    );
    expect(result).toBe('D:/New/path');
  });

  it('should return non-string values unchanged', () => {
    expect(replacePath(42, 'old', 'new')).toBe(42);
    expect(replacePath(null, 'old', 'new')).toBe(null);
    expect(replacePath(undefined, 'old', 'new')).toBe(undefined);
  });

  it('should handle path as substring', () => {
    const result = replacePath(
      'C:/Users/Test/old-project/src/file.js',
      'C:\\Users\\Test\\old-project',
      'C:\\Users\\Test\\new-project'
    );
    expect(result).toBe('C:/Users/Test/new-project/src/file.js');
  });
});
