import { describe, it, expect } from 'vitest';
import { encodeProjectPath } from '../src/encoder.js';

describe('encodeProjectPath', () => {
  it('should encode basic Windows path', () => {
    expect(encodeProjectPath('C:\\Users\\SteppeEcho\\Desktop\\Projeler\\test'))
      .toBe('C--Users-SteppeEcho-Desktop-Projeler-test');
  });

  it('should handle forward slashes', () => {
    expect(encodeProjectPath('C:/Users/SteppeEcho/Desktop/Projeler/test'))
      .toBe('C--Users-SteppeEcho-Desktop-Projeler-test');
  });

  it('should handle spaces', () => {
    expect(encodeProjectPath('C:\\Users\\SteppeEcho\\Desktop\\Projeler\\CAREER CHAOS'))
      .toBe('C--Users-SteppeEcho-Desktop-Projeler-CAREER-CHAOS');
  });

  it('should handle dots (version numbers)', () => {
    expect(encodeProjectPath('C:\\Users\\SteppeEcho\\Desktop\\Projeler\\v0.0.1'))
      .toBe('C--Users-SteppeEcho-Desktop-Projeler-v0-0-1');
  });

  it('should handle Turkish characters', () => {
    expect(encodeProjectPath('C:\\Users\\SteppeEcho\\Desktop\\Projeler\\iş'))
      .toBe('C--Users-SteppeEcho-Desktop-Projeler-i-');
  });

  it('should handle mixed Turkish chars and spaces', () => {
    const result = encodeProjectPath('C:\\Users\\SteppeEcho\\Desktop\\Projeler\\Mc Kazmalı v8');
    expect(result).toBe('C--Users-SteppeEcho-Desktop-Projeler-Mc-Kazmal--v8');
  });

  it('should handle long Turkish path', () => {
    const result = encodeProjectPath(
      'C:\\Users\\SteppeEcho\\Desktop\\Projeler\\orvixa ai video oluşturucu yayınlayıcı'
    );
    expect(result).toContain('orvixa-ai-video-olu-turucu-yay-nlay-c-');
  });

  it('should handle path with no special characters', () => {
    expect(encodeProjectPath('C:\\simple\\path'))
      .toBe('C--simple-path');
  });

  it('should handle Unix-style paths', () => {
    expect(encodeProjectPath('/home/user/projects/test'))
      .toBe('-home-user-projects-test');
  });
});
