export type DiffCheckErrorCode = 1 | 2 | 3 | 4;

export interface DiffCheckErrorOptions {
  code: DiffCheckErrorCode;
  message: string;
  cause?: unknown;
}

export class DiffCheckError extends Error {
  readonly code: DiffCheckErrorCode;

  constructor(options: DiffCheckErrorOptions) {
    super(options.message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "DiffCheckError";
    this.code = options.code;
  }
}
