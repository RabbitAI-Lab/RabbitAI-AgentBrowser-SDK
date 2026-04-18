/**
 * Agent Browser SDK 类型定义
 */

/**
 * SDK 连接选项
 */
export interface SdkOptions {
  /** Agent 服务器地址，如 http://localhost:3100 或 https://remote-agent.example.com */
  serverUrl: string;
  /** JWT Token，远程 Agent 必填 */
  token?: string;
  /** 自动重连，默认 true */
  autoReconnect?: boolean;
  /** 最大重连次数，默认 5 */
  maxReconnectAttempts?: number;
  /** 重连延迟 ms，默认 5000 */
  reconnectDelay?: number;
  /** 心跳间隔 ms，默认 30000 */
  heartbeatInterval?: number;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * 执行单条指令的选项
 */
export interface ExecuteOptions {
  /** 引擎标识符，透传给 Agent，如 'agent-browser' */
  type: string;
  /** 单条指令文本 */
  command: string;
  /** 流式结果回调，可能多次触发 */
  onResult?: (data: string) => void;
}

/**
 * 批量执行指令的选项
 */
export interface ExecuteBatchOptions {
  /** 引擎标识符，透传给 Agent，如 'agent-browser' */
  type: string;
  /** 多条指令文本，每个元素是一行指令 */
  commands: string[];
  /** 单条指令完成时的回调 */
  onCommandResult?: (index: number, data: string, error?: string) => void;
  /** 整个批量任务完成的回调 */
  onComplete?: (successCount: number, failedCount: number) => void;
}

/**
 * 单条指令执行结果
 */
export interface ExecuteResult {
  data: string;
  error?: string;
}

/**
 * 批量执行结果
 */
export interface BatchExecuteResult {
  results: Array<{ index: number; data: string; error?: string }>;
  successCount: number;
  failedCount: number;
}

/**
 * 连接响应
 */
export interface ConnectResponse {
  connectionId: string;
  browserReady: boolean;
}
