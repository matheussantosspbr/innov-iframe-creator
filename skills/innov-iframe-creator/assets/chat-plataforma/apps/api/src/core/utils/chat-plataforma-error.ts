import { AppError } from './app-error.ts'

export class ChatPlataformaError extends AppError {
  readonly upstreamStatus: number | null
  constructor(
    statusCode: number,
    message: string,
    upstreamStatus: number | null,
    options?: ErrorOptions,
  ) {
    super(statusCode, message, options)
    this.upstreamStatus = upstreamStatus
  }
}
