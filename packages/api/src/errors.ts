export type ApiErrorKind = 'http' | 'network' | 'invalid-response';

export interface ApiErrorOptions {
  kind: ApiErrorKind;
  /** HTTP status, or 0 when no response was received. */
  status: number;
  method: string;
  /** Path relative to the API base URL, e.g. `/user/Admin`. */
  path: string;
  body?: unknown;
  cause?: unknown;
}

/**
 * Every failure of an `@oakestra/api` call: HTTP errors, network errors and responses that do not
 * match the expected shape. `message` is always something a user can read.
 */
export class ApiError extends Error {
  override name = 'ApiError' as const;
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly method: string;
  readonly path: string;
  readonly body: unknown;

  constructor(message: string, options: ApiErrorOptions) {
    super(message, { cause: options.cause });
    this.kind = options.kind;
    this.status = options.status;
    this.method = options.method;
    this.path = options.path;
    this.body = options.body;
  }
}

/**
 * Duck-typed on purpose: an addon's error may come from a different module instance than the one
 * doing the check, and `instanceof` would then be false.
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'ApiError' &&
    typeof (error as { status?: unknown }).status === 'number'
  );
}

/**
 * A sentence for a toast or an inline error, whatever was thrown. `ApiError` messages are written
 * for users already; other errors fall back to their own message.
 */
export function describeError(error: unknown): string {
  if (isApiError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong.';
}

const STATUS_MESSAGES: Readonly<Record<number, string>> = {
  400: 'The request was not accepted.',
  401: 'Your session has expired. Please log in again.',
  403: 'You do not have permission to do this.',
  404: 'The requested item does not exist.',
  409: 'This conflicts with an existing item.',
  422: 'The request was not accepted.',
  501: 'The backend does not support this yet.',
};

function fallbackMessage(status: number): string {
  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (status >= 500) return 'The Oakestra backend ran into an error.';
  return `The request failed with HTTP ${status}.`;
}

function stringField(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  // flask-smorest sometimes nests the payload: {"message": {"message": "..."}}.
  if (typeof value === 'object' && value !== null && 'message' in value) {
    return stringField(value.message);
  }
  return undefined;
}

const MAX_FIELD_ERRORS = 5;

/**
 * Walks a marshmallow error tree (`{field: ["msg"], nested: {"0": {field: ["msg"]}}}`) and
 * produces one `path: message` entry per leaf. Array indices come out as `services[0].image`.
 */
function collectFieldErrors(node: unknown, path: string, out: string[]): void {
  if (typeof node === 'string') {
    out.push(path ? `${path}: ${node}` : node);
  } else if (Array.isArray(node)) {
    for (const item of node) collectFieldErrors(item, path, out);
  } else if (typeof node === 'object' && node !== null) {
    for (const [key, child] of Object.entries(node)) {
      // `_schema` holds errors of the whole object, `_all` is webargs' equivalent.
      if (key === '_schema' || key === '_all') collectFieldErrors(child, path, out);
      else if (/^\d+$/.test(key)) collectFieldErrors(child, `${path}[${key}]`, out);
      else collectFieldErrors(child, path ? `${path}.${key}` : key, out);
    }
  }
}

/**
 * flask-smorest 422s look like `{code, status, errors: {json: {field: [msg]}}}`, with the
 * location (`json`, `query`, ...) as the first level. The body location is the one the user
 * typed, so it is left out of the text; other locations keep their name.
 */
function messageFromFieldErrors(errors: unknown): string | undefined {
  if (typeof errors !== 'object' || errors === null || Array.isArray(errors)) return undefined;
  const entries: string[] = [];
  for (const [location, tree] of Object.entries(errors)) {
    collectFieldErrors(tree, location === 'json' ? '' : location, entries);
  }
  if (entries.length === 0) return undefined;
  const shown = entries.slice(0, MAX_FIELD_ERRORS).join(' ');
  const hidden = entries.length - MAX_FIELD_ERRORS;
  return hidden > 0 ? `${shown} (and ${hidden} more)` : shown;
}

/**
 * The system-manager answers errors in several shapes depending on which layer produced them:
 * `{message}` from handlers, `{msg}` from flask-jwt-extended, `{error}` from a few endpoints,
 * `{code, status}` from flask-smorest aborts (the original message is lost there),
 * `{code, status, errors: {json: {field: [msg]}}}` from flask-smorest validation (422) and plain
 * strings. This picks the most specific one and falls back to a message per status code.
 */
export function messageFromErrorBody(body: unknown, status: number): string {
  if (typeof body === 'string') {
    const text = body.trim();
    // HTML error pages from proxies are not worth showing.
    if (text && !text.startsWith('<') && text.length < 300) return text;
    return fallbackMessage(status);
  }
  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>;
    for (const key of ['message', 'msg', 'error', 'description']) {
      const value = stringField(record[key]);
      if (value) return value;
    }
    const fieldErrors = messageFromFieldErrors(record.errors);
    if (fieldErrors) return fieldErrors;
  }
  return fallbackMessage(status);
}
