type LogFn = (fields: Record<string, unknown>, message: string) => void

export type Logger = Readonly<{ info: LogFn; warn: LogFn; error: LogFn }>

export type RequestContext = Readonly<{ requestId: string; log: Logger }>
