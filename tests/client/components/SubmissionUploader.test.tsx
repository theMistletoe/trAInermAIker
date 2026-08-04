import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SubmissionUploader } from '../../../src/client/components/SubmissionUploader';
import { ZIP_MAX_BYTES } from '../../../src/shared/constants';
import { MESSAGES } from '../../../src/shared/messages';
import { renderWithProviders } from '../../helpers/renderWithProviders';

describe('SubmissionUploader', () => {
  it('ファイル未選択のとき提出ボタンが無効になる', () => {
    renderWithProviders(<SubmissionUploader uploading={false} onUpload={vi.fn()} />);
    expect(screen.getByTestId('submission-upload-button')).toBeDisabled();
  });

  it('.zip 以外のファイルはエラートーストを出して onUpload を呼ばない', async () => {
    const onUpload = vi.fn();
    // accept 属性による除外を無効化し、不正ファイル選択のバリデーションを通す。
    const user = userEvent.setup({ applyAccept: false });
    renderWithProviders(<SubmissionUploader uploading={false} onUpload={onUpload} />);

    const file = new File(['x'], 'archive.tar.gz', { type: 'application/gzip' });
    await user.upload(screen.getByTestId('submission-file-input'), file);
    await user.click(screen.getByTestId('submission-upload-button'));

    expect(await screen.findByText(MESSAGES.submission.invalidType)).toBeInTheDocument();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('サイズ上限を超えた zip はエラートーストを出して onUpload を呼ばない', async () => {
    const onUpload = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<SubmissionUploader uploading={false} onUpload={onUpload} />);

    const file = new File(['x'], 'big.zip', { type: 'application/zip' });
    Object.defineProperty(file, 'size', { value: ZIP_MAX_BYTES + 1 });
    await user.upload(screen.getByTestId('submission-file-input'), file);
    await user.click(screen.getByTestId('submission-upload-button'));

    expect(await screen.findByText(MESSAGES.submission.tooLarge)).toBeInTheDocument();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('正しい zip はファイル名を表示し、提出で onUpload に渡す', async () => {
    const onUpload = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<SubmissionUploader uploading={false} onUpload={onUpload} />);

    const file = new File(['zip-bytes'], 'submission.zip', { type: 'application/zip' });
    await user.upload(screen.getByTestId('submission-file-input'), file);
    expect(screen.getByTestId('submission-file-name')).toHaveTextContent('submission.zip');

    await user.click(screen.getByTestId('submission-upload-button'));
    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it('大文字の .ZIP 拡張子も受け付ける', async () => {
    const onUpload = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<SubmissionUploader uploading={false} onUpload={onUpload} />);

    const file = new File(['zip-bytes'], 'REPORT.ZIP', { type: 'application/zip' });
    await user.upload(screen.getByTestId('submission-file-input'), file);
    await user.click(screen.getByTestId('submission-upload-button'));

    expect(onUpload).toHaveBeenCalledWith(file);
    expect(screen.queryByText(MESSAGES.submission.invalidType)).not.toBeInTheDocument();
  });

  it('サイズがちょうど上限の zip は許可する', async () => {
    const onUpload = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<SubmissionUploader uploading={false} onUpload={onUpload} />);

    const file = new File(['x'], 'exact.zip', { type: 'application/zip' });
    Object.defineProperty(file, 'size', { value: ZIP_MAX_BYTES });
    await user.upload(screen.getByTestId('submission-file-input'), file);
    await user.click(screen.getByTestId('submission-upload-button'));

    expect(onUpload).toHaveBeenCalledWith(file);
    expect(screen.queryByText(MESSAGES.submission.tooLarge)).not.toBeInTheDocument();
  });
});
