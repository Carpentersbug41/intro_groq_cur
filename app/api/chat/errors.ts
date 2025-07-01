export class SessionStoreUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionStoreUnavailableError';
  }
} 