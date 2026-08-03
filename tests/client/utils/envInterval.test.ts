import { describe, expect, it } from 'vitest';
import { envInterval } from '../../../src/client/utils/envInterval';

describe('envInterval', () => {
  it('undefined のとき fallback を返す', () => {
    expect(envInterval(undefined, 500)).toBe(500);
  });

  it('定義済みの空文字のとき fallback を返す（Number("")===0 の暴走防止）', () => {
    expect(envInterval('', 500)).toBe(500);
  });

  it('0 や負数のとき fallback を返す', () => {
    expect(envInterval('0', 500)).toBe(500);
    expect(envInterval('-5', 500)).toBe(500);
  });

  it('数値でない文字列のとき fallback を返す', () => {
    expect(envInterval('abc', 500)).toBe(500);
  });

  it('正の数値文字列はその値を返す', () => {
    expect(envInterval('250', 500)).toBe(250);
  });
});
