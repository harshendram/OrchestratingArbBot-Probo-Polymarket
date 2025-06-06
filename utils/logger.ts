// Logger utility for the arbitrage bot
import { getConfig } from '../config';

enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

class Logger {
    private logLevel: LogLevel;
    
    constructor() {
        const config = getConfig();
        switch (config.logLevel) {
            case 'debug':
                this.logLevel = LogLevel.DEBUG;
                break;
            case 'info':
                this.logLevel = LogLevel.INFO;
                break;
            case 'warn':
                this.logLevel = LogLevel.WARN;
                break;
            case 'error':
                this.logLevel = LogLevel.ERROR;
                break;
            default:
                this.logLevel = LogLevel.INFO;
        }
    }
    
    private formatMessage(level: string, message: string, data?: any): string {
        const timestamp = new Date().toISOString();
        let logMessage = `[${timestamp}] [${level}] ${message}`;
        
        if (data) {
            if (typeof data === 'object') {
                try {
                    const jsonStr = JSON.stringify(data, null, 2);
                    logMessage += `\n${jsonStr}`;
                } catch (err) {
                    logMessage += ` ${data}`;
                }
            } else {
                logMessage += ` ${data}`;
            }
        }
        
        return logMessage;
    }
    
    debug(message: string, data?: any): void {
        if (this.logLevel <= LogLevel.DEBUG) {
            console.log(this.formatMessage('DEBUG', message, data));
        }
    }
    
    info(message: string, data?: any): void {
        if (this.logLevel <= LogLevel.INFO) {
            console.log(this.formatMessage('INFO', message, data));
        }
    }
    
    warn(message: string, data?: any): void {
        if (this.logLevel <= LogLevel.WARN) {
            console.warn(this.formatMessage('WARN', message, data));
        }
    }
    
    error(message: string, data?: any): void {
        if (this.logLevel <= LogLevel.ERROR) {
            console.error(this.formatMessage('ERROR', message, data));
        }
    }
}

export const logger = new Logger();
