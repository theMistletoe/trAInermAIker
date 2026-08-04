import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CodeFileViewer } from '../../../src/client/components/CodeFileViewer';
import { MESSAGES } from '../../../src/shared/messages';
import { renderWithProviders } from '../../helpers/renderWithProviders';
import { buildSubmissionFileMeta } from '../../mocks/factories';

const files = [buildSubmissionFileMeta(), buildSubmissionFileMeta({ path: 'README.md', size: 64 })];

describe('CodeFileViewer', () => {
  it('files が空のとき空状態を表示する', () => {
    renderWithProviders(
      <CodeFileViewer
        files={[]}
        selectedPath={null}
        onSelect={vi.fn()}
        content={null}
        loading={false}
      />,
    );
    expect(screen.getByTestId('submission-files-empty')).toHaveTextContent(
      MESSAGES.submission.filesEmpty,
    );
  });

  it('ファイルのクリックで onSelect が path 付きで呼ばれ、選択中は aria-pressed になる', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <CodeFileViewer
        files={files}
        selectedPath="src/index.ts"
        onSelect={onSelect}
        content={null}
        loading={false}
      />,
    );

    const items = screen.getAllByTestId('submission-file-item');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute('aria-pressed', 'true');
    expect(items[1]).toHaveAttribute('aria-pressed', 'false');

    const readme = items[1];
    if (!readme) throw new Error('unreachable');
    await user.click(readme);
    expect(onSelect).toHaveBeenCalledWith('README.md');
  });

  it('.ts の content はシンタックスハイライトされて描画される', () => {
    const { container } = renderWithProviders(
      <CodeFileViewer
        files={files}
        selectedPath="src/index.ts"
        onSelect={vi.fn()}
        content={{ path: 'src/index.ts', content: 'const x = 1;', isTruncated: false }}
        loading={false}
      />,
    );

    expect(screen.getByTestId('submission-file-content')).toHaveTextContent('const x = 1;');
    expect(container.querySelector('.hljs-keyword')).not.toBeNull();
    expect(screen.queryByTestId('submission-file-truncated')).not.toBeInTheDocument();
  });

  it('isTruncated のとき省略の注記を表示する', () => {
    renderWithProviders(
      <CodeFileViewer
        files={files}
        selectedPath="src/index.ts"
        onSelect={vi.fn()}
        content={{ path: 'src/index.ts', content: 'const x = 1;', isTruncated: true }}
        loading={false}
      />,
    );
    expect(screen.getByTestId('submission-file-truncated')).toBeInTheDocument();
  });
});
