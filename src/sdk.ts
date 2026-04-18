/**
 * Agent Browser SDK - 连接到 agent-browser agent，发送指令并接收流式结果
 */

import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import {
  SdkOptions,
  ExecuteOptions,
  ExecuteBatchOptions,
  ExecuteResult,
  BatchExecuteResult,
  ConnectResponse,
} from './types';

const DEFAULT_OPTIONS: Partial<SdkOptions> = {
  autoReconnect: true,
  maxReconnectAttempts: 5,
  reconnectDelay: 5000,
  heartbeatInterval: 30000,
  debug: false,
};

export class AgentBrowserSdk {
  private socket: Socket | null = null;
  private options: SdkOptions;
  private connectionId: string | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isManualDisconnect = false;

  constructor(options: SdkOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 连接到 Agent
   */
  async connect(): Promise<ConnectResponse> {
    if (this.socket?.connected) {
      return { connectionId: this.connectionId!, browserReady: true };
    }

    return new Promise((resolve, reject) => {
      this.socket = io(`${this.options.serverUrl}/agent-browser`, {
        transports: ['websocket'],
        auth: {
          token: this.options.token,
        },
        reconnection: this.options.autoReconnect,
        reconnectionAttempts: this.options.maxReconnectAttempts,
        reconnectionDelay: this.options.reconnectDelay,
      });

      this.socket.on('connected', (data: ConnectResponse) => {
        this.connectionId = data.connectionId;
        this.startHeartbeat();
        this.log('Connected:', data.connectionId);
        resolve(data);
      });

      this.socket.on('error', (data: { message: string }) => {
        const error = new Error(data.message);
        this.log('Error:', data.message);
        reject(error);
      });

      this.socket.on('disconnect', (reason: string) => {
        this.stopHeartbeat();
        this.log('Disconnected:', reason);

        if (!this.isManualDisconnect && this.options.autoReconnect) {
          this.startManualReconnect();
        }
      });

      this.socket.on('connect_error', (error: Error) => {
        this.log('Connection error:', error.message);
        reject(error);
      });
    });
  }

  /**
   * 执行单条指令
   */
  async execute(options: ExecuteOptions): Promise<ExecuteResult> {
    this.ensureConnected();

    const requestId = uuidv4();

    return new Promise((resolve) => {
      let accumulatedData = '';

      const handler = (payload: {
        requestId: string;
        data: string;
        done: boolean;
        error?: string;
      }) => {
        if (payload.requestId !== requestId) return;

        if (!payload.done) {
          accumulatedData += payload.data;
          options.onResult?.(payload.data);
        } else {
          this.socket?.off('result', handler);
          // done=true 时，payload.data 是引擎的最终返回结果
          // 将流式中间数据和最终结果合并返回
          const finalData = payload.data
            ? accumulatedData + payload.data
            : accumulatedData;
          resolve({
            data: finalData,
            error: payload.error,
          });
        }
      };

      this.socket?.on('result', handler);
      this.socket?.emit('execute', {
        requestId,
        type: options.type,
        command: options.command,
      });
    });
  }

  /**
   * 批量执行指令
   */
  async executeBatch(options: ExecuteBatchOptions): Promise<BatchExecuteResult> {
    this.ensureConnected();

    const batchId = uuidv4();

    return new Promise((resolve) => {
      const results: Array<{ index: number; data: string; error?: string }> = [];

      const batchResultHandler = (payload: {
        batchId: string;
        index: number;
        requestId: string;
        data: string;
        done: boolean;
        error?: string;
      }) => {
        if (payload.batchId !== batchId) return;

        results.push({
          index: payload.index,
          data: payload.data,
          error: payload.error,
        });

        options.onCommandResult?.(payload.index, payload.data, payload.error);
      };

      const batchCompleteHandler = (payload: {
        batchId: string;
        totalCommands: number;
        successCount: number;
        failedCount: number;
      }) => {
        if (payload.batchId !== batchId) return;

        this.socket?.off('batch_result', batchResultHandler);
        this.socket?.off('batch_complete', batchCompleteHandler);

        options.onComplete?.(payload.successCount, payload.failedCount);

        resolve({
          results: results.sort((a, b) => a.index - b.index),
          successCount: payload.successCount,
          failedCount: payload.failedCount,
        });
      };

      this.socket?.on('batch_result', batchResultHandler);
      this.socket?.on('batch_complete', batchCompleteHandler);
      this.socket?.emit('execute_batch', {
        batchId,
        type: options.type,
        commands: options.commands,
      });
    });
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    this.isManualDisconnect = true;
    this.stopHeartbeat();
    this.stopManualReconnect();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.connectionId = null;
    this.log('Disconnected');
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.socket?.connected === true;
  }

  // ========== 私有方法 ==========

  private ensureConnected(): void {
    if (!this.socket?.connected) {
      throw new Error('Not connected to agent. Call connect() first.');
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const interval = this.options.heartbeatInterval || 30000;

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.socket?.emit('ping', { timestamp: Date.now() });
      }
    }, interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startManualReconnect(): void {
    this.stopManualReconnect();

    setTimeout(async () => {
      if (this.isManualDisconnect) return;

      this.log('Reconnecting...');

      try {
        if (this.socket) {
          this.socket.removeAllListeners();
          this.socket.disconnect();
          this.socket = null;
        }
        await this.connect();
        this.log('Reconnected successfully');
      } catch {
        this.log('Reconnect failed, will retry');
        if (!this.isManualDisconnect) {
          this.startManualReconnect();
        }
      }
    }, this.options.reconnectDelay || 5000);
  }

  private stopManualReconnect(): void {
    // setTimeout 无法直接清除，通过 isManualDisconnect 标志控制
  }

  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.log('[AgentBrowserSdk]', ...args);
    }
  }
}
