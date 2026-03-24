export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(context: LogContext): Logger;
}

function write(level: "INFO" | "WARN" | "ERROR", message: string, context?: LogContext) {
  const payload = {
    level,
    message,
    context: context || {},
    timestamp: new Date().toISOString(),
  };
  const line = JSON.stringify(payload);

  if (level === "ERROR") {
    console.error(line);
    return;
  }

  if (level === "WARN") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export const consoleLogger: Logger = {
  info(message, context) {
    write("INFO", message, context);
  },
  warn(message, context) {
    write("WARN", message, context);
  },
  error(message, context) {
    write("ERROR", message, context);
  },
  child(boundContext) {
    return {
      info(message, context) {
        write("INFO", message, { ...boundContext, ...context });
      },
      warn(message, context) {
        write("WARN", message, { ...boundContext, ...context });
      },
      error(message, context) {
        write("ERROR", message, { ...boundContext, ...context });
      },
      child(nextContext) {
        return consoleLogger.child({ ...boundContext, ...nextContext });
      },
    };
  },
};
