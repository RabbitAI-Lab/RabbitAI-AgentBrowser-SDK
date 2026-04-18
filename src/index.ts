/**
 * Agent Browser SDK for RabbitAI
 *
 * 连接到 agent-browser agent，发送浏览器操作指令并接收流式结果
 */

export { AgentBrowserSdk } from './sdk';

export type {
  SdkOptions,
  ExecuteOptions,
  ExecuteBatchOptions,
  ExecuteResult,
  BatchExecuteResult,
  ConnectResponse,
} from './types';
