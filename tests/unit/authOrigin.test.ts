import { describe, expect, it } from 'vitest';
import { isLocalOrigin } from '../../src/server/auth';

describe('isLocalOrigin', () => {
  it('本物のローカルオリジンを local と判定する', () => {
    expect(isLocalOrigin('http://localhost:5173')).toBe(true);
    expect(isLocalOrigin('http://127.0.0.1:5173')).toBe(true);
    expect(isLocalOrigin('http://[::1]:5173')).toBe(true);
  });

  it('ホスト名に localhost/127.0.0.1 を含むだけの非ローカルは local と判定しない', () => {
    // 部分一致だと誤って local 扱いになる代表例（セッション署名を弱めるリスク）。
    expect(isLocalOrigin('https://evil-localhost.example')).toBe(false);
    expect(isLocalOrigin('https://localhost.attacker.com')).toBe(false);
    expect(isLocalOrigin('https://127.0.0.1.attacker.com')).toBe(false);
    expect(isLocalOrigin('https://app.example.com')).toBe(false);
  });

  it('パースできない文字列は非ローカル扱い', () => {
    expect(isLocalOrigin('not a url')).toBe(false);
    expect(isLocalOrigin('')).toBe(false);
  });
});
