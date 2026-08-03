import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type AiClient,
  createRestAiClient,
  SUMMARIZE_MODEL,
  stubSummarize,
  summarizerDepsFromEnv,
  summarizeText,
} from '../../src/server/lib/summarizer';

describe('サマライザ (summarizeText)', () => {
  describe('スタブ要約 (stubSummarize)', () => {
    it('空白を正規化して決定的な結果を返す', () => {
      expect(stubSummarize('  こんにちは \n\n 世界  です  ')).toBe('こんにちは 世界 です');
      expect(stubSummarize('  こんにちは \n\n 世界  です  ')).toBe(
        stubSummarize('  こんにちは \n\n 世界  です  '),
      );
    });

    it('500字を超えるテキストは切り詰めて末尾に…を付ける', () => {
      const long = 'あ'.repeat(600);
      const out = stubSummarize(long);
      expect(out).toHaveLength(501);
      expect(out.endsWith('…')).toBe(true);
    });
  });

  it('forceStubのときAIを呼ばずスタブ結果を返す', async () => {
    const run = vi.fn();
    const out = await summarizeText({ ai: { run }, forceStub: true }, 'これは  テキストです');
    expect(out).toBe('これは テキストです');
    expect(run).not.toHaveBeenCalled();
  });

  it('AIバインディングが無いときスタブ結果を返す', async () => {
    const out = await summarizeText({}, 'テキスト');
    expect(out).toBe('テキスト');
  });

  it('AI成功時はモデルIDと入力テキストのみで呼び、整形結果を返す', async () => {
    const run = vi.fn().mockResolvedValue({ response: '  整形された要約です。  ' });
    const ai: AiClient = { run };

    const out = await summarizeText({ ai }, '毎日少しずつ練習する予定です');

    expect(out).toBe('整形された要約です。');
    expect(run).toHaveBeenCalledTimes(1);
    const [model, inputs] = run.mock.calls[0] as [string, { messages: { content: string }[] }];
    expect(model).toBe(SUMMARIZE_MODEL);
    expect(inputs.messages.at(-1)?.content).toBe('毎日少しずつ練習する予定です');
  });

  it('プロンプトは忠実な要約を指示し、外部知識の追加や推測を明示的に禁じている', async () => {
    const run = vi.fn().mockResolvedValue({ response: '整形結果' });
    await summarizeText({ ai: { run } }, '入力テキスト');
    const [, inputs] = run.mock.calls[0] as [string, { messages: { content: string }[] }];
    const system = inputs.messages[0]?.content ?? '';
    expect(system).toContain('忠実な要約担当');
    expect(system).toContain('入力テキストだけを情報源として');
    expect(system).toContain(
      '推測、補足説明、外部知識、一般論、評価、感想、新しい結論を追加しない',
    );
    expect(system).toContain('［原文不明瞭］');
  });

  it('OpenAI互換のchoices形式の出力も受け取れる（現行llama系RESTの実挙動）', async () => {
    const run = vi.fn().mockResolvedValue({
      choices: [{ message: { role: 'assistant', content: ' choices形式の整形結果です。 ' } }],
    });
    const out = await summarizeText({ ai: { run } }, '入力テキスト');
    expect(out).toBe('choices形式の整形結果です。');
  });

  it('AIの出力が想定形でないときスタブへフォールバックする', async () => {
    const run = vi.fn().mockResolvedValue({ unexpected: true });
    const out = await summarizeText({ ai: { run } }, '元の  テキスト');
    expect(out).toBe('元の テキスト');
  });

  it('AI呼び出しが例外を投げたときスタブへフォールバックする', async () => {
    const run = vi.fn().mockRejectedValue(new Error('no cloudflare auth'));
    const out = await summarizeText({ ai: { run } }, '元のテキスト');
    expect(out).toBe('元のテキスト');
  });
});

describe('env からの deps 解決 (summarizerDepsFromEnv)', () => {
  const fakeAi: AiClient = { run: vi.fn() };

  it('AI_STUB=1 が最優先で forceStub になる', () => {
    const deps = summarizerDepsFromEnv({
      AI_STUB: '1',
      AI: fakeAi,
      CLOUDFLARE_ACCOUNT_ID: 'acc',
      CLOUDFLARE_AI_TOKEN: 'tok',
    });
    expect(deps).toEqual({ forceStub: true });
  });

  it('ネイティブバインディングがあればそれを使う', () => {
    const deps = summarizerDepsFromEnv({ AI: fakeAi });
    expect(deps.ai).toBe(fakeAi);
  });

  it('RESTクレデンシャルが揃っていればRESTクライアントを返す', () => {
    const deps = summarizerDepsFromEnv({
      CLOUDFLARE_ACCOUNT_ID: 'acc',
      CLOUDFLARE_AI_TOKEN: 'tok',
    });
    expect(deps.ai).toBeDefined();
    expect(deps.forceStub).toBeUndefined();
  });

  it('何も無ければ空のdeps（スタブ動作）を返す', () => {
    expect(summarizerDepsFromEnv({})).toEqual({});
    expect(summarizerDepsFromEnv({ CLOUDFLARE_ACCOUNT_ID: 'acc' })).toEqual({});
  });
});

describe('Workers AI RESTクライアント (createRestAiClient)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('アカウント/モデルのURLへトークン付きPOSTし、resultを返す', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, result: { response: '要約' } }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = createRestAiClient('acc-123', 'tok-456');
    const out = await client.run(SUMMARIZE_MODEL, { messages: [] });

    expect(out).toEqual({ response: '要約' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.cloudflare.com/client/v4/accounts/acc-123/ai/run/${SUMMARIZE_MODEL}`,
    );
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer tok-456');
  });

  it('HTTPエラーのとき例外を投げる（summarizeText側でスタブに落ちる）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('denied', { status: 403 })));
    const client = createRestAiClient('acc', 'tok');
    await expect(client.run(SUMMARIZE_MODEL, {})).rejects.toThrow('403');
  });

  it('success=false のとき例外を投げる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: false, errors: [{ message: 'bad model' }] }), {
          status: 200,
        }),
      ),
    );
    const client = createRestAiClient('acc', 'tok');
    // Cloudflare 側のエラーメッセージが切り分け用に含まれること
    await expect(client.run(SUMMARIZE_MODEL, {})).rejects.toThrow('success=false: bad model');
  });
});
