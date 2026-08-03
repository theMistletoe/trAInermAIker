import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiDepsFromEnv, createOpenAiClient, DEFAULT_OPENAI_MODEL } from '../../src/server/lib/ai';

function stubFetchOk(content: string) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }),
    );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function capturedBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe('OpenAI RESTクライアント (createOpenAiClient)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('chat/completionsのURLへBearerトークン付きPOSTし、modelとmessagesを送る', async () => {
    const fetchMock = stubFetchOk('回答です');
    const client = createOpenAiClient('test-key', 'gpt-5.6');

    const out = await client.complete({
      messages: [{ role: 'user', content: 'こんにちは' }],
      timeoutMs: 1000,
    });

    expect(out).toBe('回答です');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer test-key');
    const body = capturedBody(fetchMock);
    expect(body.model).toBe('gpt-5.6');
    expect(body.messages).toEqual([{ role: 'user', content: 'こんにちは' }]);
  });

  it('temperatureキーをボディに含めない（gpt-5系は非デフォルト値を拒否する）', async () => {
    const fetchMock = stubFetchOk('回答');
    const client = createOpenAiClient('test-key', 'gpt-5.6');
    await client.complete({ messages: [{ role: 'user', content: 'q' }], timeoutMs: 1000 });
    expect(capturedBody(fetchMock)).not.toHaveProperty('temperature');
  });

  it('jsonMode=trueのときのみresponse_format: json_objectを付ける', async () => {
    const fetchMock = stubFetchOk('{"ok":true}');
    const client = createOpenAiClient('test-key', 'gpt-5.6');
    await client.complete({
      messages: [{ role: 'user', content: 'q' }],
      jsonMode: true,
      timeoutMs: 1000,
    });
    expect(capturedBody(fetchMock).response_format).toEqual({ type: 'json_object' });
  });

  it('jsonMode未指定のときresponse_formatを付けない', async () => {
    const fetchMock = stubFetchOk('回答');
    const client = createOpenAiClient('test-key', 'gpt-5.6');
    await client.complete({ messages: [{ role: 'user', content: 'q' }], timeoutMs: 1000 });
    expect(capturedBody(fetchMock)).not.toHaveProperty('response_format');
  });

  it('maxCompletionTokens指定時はmax_completion_tokensとして渡す', async () => {
    const fetchMock = stubFetchOk('回答');
    const client = createOpenAiClient('test-key', 'gpt-5.6');
    await client.complete({
      messages: [{ role: 'user', content: 'q' }],
      maxCompletionTokens: 512,
      timeoutMs: 1000,
    });
    expect(capturedBody(fetchMock).max_completion_tokens).toBe(512);
  });

  it('maxCompletionTokens未指定のときmax_completion_tokensを付けない', async () => {
    const fetchMock = stubFetchOk('回答');
    const client = createOpenAiClient('test-key', 'gpt-5.6');
    await client.complete({ messages: [{ role: 'user', content: 'q' }], timeoutMs: 1000 });
    expect(capturedBody(fetchMock)).not.toHaveProperty('max_completion_tokens');
  });

  it('timeoutMsからAbortSignalを設定する', async () => {
    const fetchMock = stubFetchOk('回答');
    const client = createOpenAiClient('test-key', 'gpt-5.6');
    await client.complete({ messages: [{ role: 'user', content: 'q' }], timeoutMs: 1000 });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('HTTPエラーのときステータスとボディ断片を含む例外を投げる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('invalid api key', { status: 403 })),
    );
    const client = createOpenAiClient('bad-key', 'gpt-5.6');
    await expect(
      client.complete({ messages: [{ role: 'user', content: 'q' }], timeoutMs: 1000 }),
    ).rejects.toThrow(/403.*invalid api key/);
  });

  it('choicesが空のとき例外を投げる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 })),
    );
    const client = createOpenAiClient('test-key', 'gpt-5.6');
    await expect(
      client.complete({ messages: [{ role: 'user', content: 'q' }], timeoutMs: 1000 }),
    ).rejects.toThrow('OpenAI response had no message content');
  });

  it('contentが欠けているとき例外を投げる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { role: 'assistant' } }] }), {
          status: 200,
        }),
      ),
    );
    const client = createOpenAiClient('test-key', 'gpt-5.6');
    await expect(
      client.complete({ messages: [{ role: 'user', content: 'q' }], timeoutMs: 1000 }),
    ).rejects.toThrow('OpenAI response had no message content');
  });

  it('正常なchoicesのときcontent文字列を返す', async () => {
    stubFetchOk('生成されたテキスト');
    const client = createOpenAiClient('test-key', 'gpt-5.6');
    const out = await client.complete({
      messages: [{ role: 'user', content: 'q' }],
      timeoutMs: 1000,
    });
    expect(out).toBe('生成されたテキスト');
  });
});

describe('env からの deps 解決 (aiDepsFromEnv)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('AI_STUBはOPENAI_API_KEYより優先される', () => {
    const deps = aiDepsFromEnv({ AI_STUB: '1', OPENAI_API_KEY: 'k' });
    expect(deps.forceStub).toBe(true);
    expect(deps.client).toBeUndefined();
  });

  it('OPENAI_API_KEYがあればクライアントを返す', () => {
    const deps = aiDepsFromEnv({ OPENAI_API_KEY: 'k' });
    expect(deps.client).toBeDefined();
    expect(deps.forceStub).toBeUndefined();
  });

  it('OPENAI_MODELが設定されていればデフォルトの代わりにそのモデルを使う', async () => {
    const fetchMock = stubFetchOk('回答');
    const deps = aiDepsFromEnv({ OPENAI_API_KEY: 'k', OPENAI_MODEL: 'gpt-5.6-terra' });
    await deps.client?.complete({ messages: [{ role: 'user', content: 'q' }], timeoutMs: 1000 });
    expect(capturedBody(fetchMock).model).toBe('gpt-5.6-terra');
    expect(capturedBody(fetchMock).model).not.toBe(DEFAULT_OPENAI_MODEL);
  });

  it('何も無ければ空のdeps（スタブ動作）を返す', () => {
    expect(aiDepsFromEnv({})).toEqual({});
  });
});
