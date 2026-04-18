# @rabbitai-lab/agent-browser-sdk

Agent Browser SDK for RabbitAI - connect to an agent-browser agent via Socket.IO and execute browser commands with streaming results.

## Installation

```bash
npm install @rabbitai-lab/agent-browser-sdk
```

## Quick Start

```typescript
import { AgentBrowserSdk } from '@rabbitai-lab/agent-browser-sdk';

const sdk = new AgentBrowserSdk({
  serverUrl: 'http://localhost:3100',
  token: 'your-jwt-token', // Required for remote mode, omit for local mode
  debug: true,
});

// Connect to the agent
const { connectionId, browserReady } = await sdk.connect();
console.log('Connected:', connectionId);

// Execute a single command with streaming results
const result = await sdk.execute({
  type: 'agent-browser',
  command: 'navigate to https://example.com',
  onResult: (data) => {
    console.log('Streaming data:', data);
  },
});
console.log('Final result:', result.data);

// Execute a batch of commands
const batchResult = await sdk.executeBatch({
  type: 'agent-browser',
  commands: [
    'navigate to https://example.com',
    'click the login button',
    'type "hello" into the search box',
  ],
  onCommandResult: (index, data, error) => {
    console.log(`Command ${index} completed:`, data);
  },
  onComplete: (successCount, failedCount) => {
    console.log(`Done: ${successCount} succeeded, ${failedCount} failed`);
  },
});

// Disconnect
await sdk.disconnect();
```

## API Reference

### `AgentBrowserSdk`

#### Constructor

```typescript
new AgentBrowserSdk(options: SdkOptions)
```

#### `connect(): Promise<ConnectResponse>`

Connect to the agent server. Returns `{ connectionId, browserReady }`.

#### `execute(options: ExecuteOptions): Promise<ExecuteResult>`

Execute a single command with optional streaming callback.

```typescript
interface ExecuteOptions {
  type: string;          // Engine identifier, e.g. 'agent-browser'
  command: string;       // Command text
  onResult?: (data: string) => void;  // Streaming result callback
}
```

#### `executeBatch(options: ExecuteBatchOptions): Promise<BatchExecuteResult>`

Execute multiple commands sequentially.

```typescript
interface ExecuteBatchOptions {
  type: string;
  commands: string[];
  onCommandResult?: (index: number, data: string, error?: string) => void;
  onComplete?: (successCount: number, failedCount: number) => void;
}
```

#### `disconnect(): Promise<void>`

Disconnect from the agent server.

#### `isConnected(): boolean`

Check if currently connected.

### Types

```typescript
interface SdkOptions {
  serverUrl: string;            // Agent server URL
  token?: string;               // JWT token for remote mode
  autoReconnect?: boolean;      // Auto reconnect (default: true)
  maxReconnectAttempts?: number; // Max reconnect attempts (default: 5)
  reconnectDelay?: number;      // Reconnect delay in ms (default: 5000)
  heartbeatInterval?: number;   // Heartbeat interval in ms (default: 30000)
  debug?: boolean;              // Enable debug logging
}

interface ExecuteResult {
  data: string;
  error?: string;
}

interface BatchExecuteResult {
  results: Array<{ index: number; data: string; error?: string }>;
  successCount: number;
  failedCount: number;
}

interface ConnectResponse {
  connectionId: string;
  browserReady: boolean;
}
```

## Related Packages

- [@rabbitai-lab/agent-browser-agent](https://www.npmjs.com/package/@rabbitai-lab/agent-browser-agent) - The agent server that receives and executes browser commands

## License

MIT
