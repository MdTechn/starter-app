import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRequestId } from '../request-context';

const LEVEL_ORDER: Record<LogLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  log: 3,
  debug: 4,
  verbose: 5,
};

@Injectable()
export class AppLogger implements LoggerService {
  private context?: string;
  private readonly minLevel: LogLevel;

  constructor(private readonly config: ConfigService) {
    this.minLevel = this.config.get<LogLevel>('LOG_LEVEL', 'log');
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: unknown, context?: string) {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string) {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string) {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string) {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string) {
    this.write('verbose', message, context);
  }

  fatal(message: unknown, context?: string) {
    this.write('fatal', message, context);
  }

  private write(
    level: LogLevel,
    message: unknown,
    context?: string,
    trace?: string,
  ) {
    if (LEVEL_ORDER[level] > LEVEL_ORDER[this.minLevel]) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      context: context ?? this.context ?? 'App',
      requestId: getRequestId(),
      message: typeof message === 'string' ? message : JSON.stringify(message),
      ...(trace ? { trace } : {}),
    };

    const line = JSON.stringify(entry);
    if (level === 'error' || level === 'fatal') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
}
