import type { ApiErrorBody, ApiErrorCode } from '../../shared/schemas';

export function errorBody(code: ApiErrorCode, message?: string): ApiErrorBody {
  return message ? { error: code, message } : { error: code };
}
