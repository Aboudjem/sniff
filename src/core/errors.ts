export class SniffError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SniffError';
    this.code = code;
  }
}
