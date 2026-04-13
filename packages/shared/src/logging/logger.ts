export interface LogContext {
  [key: string]: unknown;
}

export interface Logger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(context: LogContext): Logger;
}

type LoggerLevel = "INFO" | "WARN" | "ERROR";

const loggerLevelPriority: Record<LoggerLevel, number> = {
  INFO: 0,
  WARN: 1,
  ERROR: 2,
};

function resolveMinimumLoggerLevel(): LoggerLevel {
  const configuredLevel = String(process.env.KK_LOG_LEVEL || "").trim().toUpperCase();
  if (configuredLevel === "INFO" || configuredLevel === "WARN" || configuredLevel === "ERROR") {
    return configuredLevel;
  }

  return "INFO";
}

function shouldWrite(level: LoggerLevel): boolean {
  return loggerLevelPriority[level] >= loggerLevelPriority[resolveMinimumLoggerLevel()];
}

function write(level: LoggerLevel, message: string, context?: LogContext) {
  if (!shouldWrite(level)) {
    return;
  }

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
