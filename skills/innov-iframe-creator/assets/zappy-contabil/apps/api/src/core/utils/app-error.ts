export class AppError extends Error {
  readonly statusCode: number
  constructor(statusCode: number, message: string, options?: ErrorOptions) {
    super(message, options)
    this.statusCode = statusCode
  }
}
