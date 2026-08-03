import { describe, expect, it } from 'vitest';
import {
  apiErrorBodySchema,
  createNoteBodySchema,
  noteIdParamSchema,
} from '../../src/shared/schemas';

describe('ノート作成リクエストのボディスキーマ (createNoteBodySchema)', () => {
  it('通常の文を受け入れる', () => {
    expect(createNoteBodySchema.safeParse({ body: 'hello note' }).success).toBe(true);
  });

  it('空文字列を拒否する', () => {
    expect(createNoteBodySchema.safeParse({ body: '' }).success).toBe(false);
  });

  it('空白文字のみを拒否する', () => {
    expect(createNoteBodySchema.safeParse({ body: '   \n\t  ' }).success).toBe(false);
  });

  it('ちょうど2000文字を受け入れる', () => {
    expect(createNoteBodySchema.safeParse({ body: 'a'.repeat(2000) }).success).toBe(true);
  });

  it('2001文字を拒否する', () => {
    expect(createNoteBodySchema.safeParse({ body: 'a'.repeat(2001) }).success).toBe(false);
  });

  it('前後に空白があってもトリム後に上限以内ならbodyを受け入れる', () => {
    const padded = ' '.repeat(50) + 'a'.repeat(1990) + ' '.repeat(50);
    const r = createNoteBodySchema.safeParse({ body: padded });
    expect(r.success).toBe(true);
    expect(r.success && r.data.body.length).toBe(1990);
  });

  it('トリム済みの値を返す', () => {
    const r = createNoteBodySchema.safeParse({ body: '  hello  ' });
    expect(r.success && r.data.body).toBe('hello');
  });
});

describe('ノートIDのパラメータスキーマ (noteIdParamSchema)', () => {
  it('文字列のidを数値に変換する', () => {
    const r = noteIdParamSchema.safeParse({ id: '42' });
    expect(r.success).toBe(true);
    expect(r.success && r.data.id).toBe(42);
  });

  it('0以下のidを拒否する', () => {
    expect(noteIdParamSchema.safeParse({ id: '0' }).success).toBe(false);
    expect(noteIdParamSchema.safeParse({ id: '-1' }).success).toBe(false);
  });

  it('数値以外のidを拒否する', () => {
    expect(noteIdParamSchema.safeParse({ id: 'foo' }).success).toBe(false);
  });
});

describe('エラーボディのスキーマ (apiErrorBodySchema)', () => {
  it('既知のエラーコードを受け入れる', () => {
    const r = apiErrorBodySchema.safeParse({ error: 'NOTE_NOT_FOUND' });
    expect(r.success && r.data.error).toBe('NOTE_NOT_FOUND');
  });

  it('未知のエラーコードはINTERNAL_ERRORに吸収する', () => {
    const r = apiErrorBodySchema.safeParse({ error: 'SOMETHING_NEW' });
    expect(r.success).toBe(true);
    expect(r.success && r.data.error).toBe('INTERNAL_ERROR');
  });
});
