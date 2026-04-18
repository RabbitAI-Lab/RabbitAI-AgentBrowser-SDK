#!/usr/bin/env node
/**
 * Agent Browser SDK CLI
 *
 * 用于测试和验证 Agent Browser Agent 的命令行工具
 *
 * 用法:
 *   agent-browser-sdk [options]
 *
 * 选项:
 *   -s, --server <url>             Agent 服务器地址 (默认: http://localhost:3100)
 *   -t, --token <token>            认证 Token (远程模式必填)
 *   -c, --command <cmd>            执行单条指令
 *   -f, --file <path>              从文件读取指令并批量执行
 *   --type <type>                  引擎类型 (默认: agent-browser)
 *   -i, --interactive              交互式 REPL 模式
 *   --no-stream                    不显示流式输出，仅显示最终结果
 *   -d, --debug                    启用调试日志
 *   -h, --help                     显示帮助信息
 *   -v, --version                  显示版本号
 */

import { AgentBrowserSdk } from './sdk';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';

// ========== 参数解析 ==========

interface CliArgs {
  server?: string;
  token?: string;
  command?: string;
  file?: string;
  type?: string;
  interactive?: boolean;
  noStream?: boolean;
  debug?: boolean;
  help?: boolean;
  version?: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  let i = 2;

  while (i < argv.length) {
    const arg = argv[i];

    switch (arg) {
      case '-s':
      case '--server':
        args.server = argv[++i];
        if (!args.server) {
          console.error('Error: --server requires a URL');
          process.exit(1);
        }
        break;
      case '-t':
      case '--token':
        args.token = argv[++i];
        if (!args.token) {
          console.error('Error: --token requires a token string');
          process.exit(1);
        }
        break;
      case '-c':
      case '--command':
        args.command = argv[++i];
        if (!args.command) {
          console.error('Error: --command requires a command string');
          process.exit(1);
        }
        break;
      case '-f':
      case '--file':
        args.file = argv[++i];
        if (!args.file) {
          console.error('Error: --file requires a file path');
          process.exit(1);
        }
        break;
      case '--type':
        args.type = argv[++i];
        if (!args.type) {
          console.error('Error: --type requires a type string');
          process.exit(1);
        }
        break;
      case '-i':
      case '--interactive':
        args.interactive = true;
        break;
      case '--no-stream':
        args.noStream = true;
        break;
      case '-d':
      case '--debug':
        args.debug = true;
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-v':
      case '--version':
        args.version = true;
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        console.error('Use --help for usage information');
        process.exit(1);
    }
    i++;
  }

  return args;
}

// ========== 帮助 & 版本 ==========

function showHelp(): void {
  console.log(`
Agent Browser SDK CLI - RabbitAI Agent 测试验证工具

用法:
  agent-browser-sdk [options]

模式:
  单命令模式    使用 -c 传递一条指令，执行后输出结果并退出
  文件批量模式  使用 -f 传递文件路径，按行读取指令并批量执行
  交互式模式    使用 -i 进入 REPL，逐行输入指令并查看结果

选项:
  -s, --server <url>             Agent 服务器地址 (默认: http://localhost:3100)
  -t, --token <token>            认证 Token (远程模式必填)
  -c, --command <cmd>            执行单条指令
  -f, --file <path>              从文件读取指令并批量执行 (每行一条)
  --type <type>                  引擎类型 (默认: agent-browser)
  -i, --interactive              交互式 REPL 模式
  --no-stream                    不显示流式输出，仅显示最终结果
  -d, --debug                    启用调试日志
  -h, --help                     显示帮助信息
  -v, --version                  显示版本号

示例:
  # 连接测试 (不带命令时只测试连接)
  agent-browser-sdk --server http://localhost:3100

  # 执行单条指令
  agent-browser-sdk -s http://localhost:3100 -c "navigate to https://example.com"

  # 远程模式 (需要 Token)
  agent-browser-sdk -s https://agent.example.com -t "your-token" -c "click login"

  # 从文件批量执行
  agent-browser-sdk -s http://localhost:3100 -f commands.txt

  # 交互式模式
  agent-browser-sdk -s http://localhost:3100 -i

  # 不显示流式输出
  agent-browser-sdk -s http://localhost:3100 --no-stream -c "take screenshot"

环境变量:
  AGENT_BROWSER_SERVER           Agent 服务器地址 (可被 --server 覆盖)
  AGENT_BROWSER_TOKEN            认证 Token (可被 --token 覆盖)
`);
}

function showVersion(): void {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    console.log(`agent-browser-sdk v${pkg.version}`);
  } catch {
    console.log('agent-browser-sdk v1.0.1');
  }
}

// ========== 执行模式 ==========

async function runSingleCommand(
  sdk: AgentBrowserSdk,
  command: string,
  type: string,
  noStream: boolean,
): Promise<void> {
  const startTime = Date.now();

  const result = await sdk.execute({
    type,
    command,
    onResult: noStream
      ? undefined
      : (data) => {
          process.stdout.write(data);
        },
  });

  const elapsed = Date.now() - startTime;

  if (noStream) {
    console.log(result.data);
  }

  if (result.error) {
    console.error(`\n[Error] ${result.error}`);
    console.log(`  Time: ${elapsed}ms`);
  } else {
    if (!noStream) {
      console.log(); // trailing newline after stream
    }
    console.log(`  Time: ${elapsed}ms`);
  }
}

async function runBatchFromFile(
  sdk: AgentBrowserSdk,
  filePath: string,
  type: string,
): Promise<void> {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error(`Error: Cannot read file: ${filePath}`);
    process.exit(1);
  }

  const commands = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  if (commands.length === 0) {
    console.error('Error: No commands found in file (empty or all comments)');
    process.exit(1);
  }

  console.log(`Executing ${commands.length} commands from ${filePath}...\n`);

  const startTime = Date.now();

  const result = await sdk.executeBatch({
    type,
    commands,
    onCommandResult: (index, data, error) => {
      const status = error ? 'FAIL' : 'OK';
      const preview = data.length > 80 ? data.slice(0, 80) + '...' : data;
      console.log(`  [${index + 1}/${commands.length}] ${status}: ${preview}`);
      if (error) {
        console.log(`    Error: ${error}`);
      }
    },
  });

  const elapsed = Date.now() - startTime;

  console.log(`\nBatch complete:`);
  console.log(`  Total:   ${result.successCount + result.failedCount}`);
  console.log(`  Success: ${result.successCount}`);
  console.log(`  Failed:  ${result.failedCount}`);
  console.log(`  Time:    ${elapsed}ms`);

  if (result.failedCount > 0) {
    console.log('\nFailed commands:');
    result.results
      .filter((r) => r.error)
      .forEach((r) => {
        console.log(`  [${r.index + 1}] ${r.error}`);
      });
  }
}

async function runInteractive(
  sdk: AgentBrowserSdk,
  type: string,
  noStream: boolean,
): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'sdk> ',
  });

  console.log('Interactive mode. Type commands to execute, or "exit" to quit.\n');

  rl.prompt();

  rl.on('line', async (line) => {
    const cmd = line.trim();

    if (!cmd) {
      rl.prompt();
      return;
    }

    if (cmd === 'exit' || cmd === 'quit') {
      console.log('Bye.');
      rl.close();
      return;
    }

    if (cmd === 'help') {
      console.log('Commands:');
      console.log('  <command>  Execute a browser command');
      console.log('  help       Show this help');
      console.log('  status     Show connection status');
      console.log('  exit/quit  Exit interactive mode');
      rl.prompt();
      return;
    }

    if (cmd === 'status') {
      console.log(`  Connected:  ${sdk.isConnected()}`);
      rl.prompt();
      return;
    }

    try {
      const startTime = Date.now();

      const result = await sdk.execute({
        type,
        command: cmd,
        onResult: noStream
          ? undefined
          : (data) => {
              process.stdout.write(data);
            },
      });

      const elapsed = Date.now() - startTime;

      if (noStream) {
        console.log(result.data);
      }

      if (result.error) {
        console.error(`\n[Error] ${result.error}`);
      } else if (!noStream) {
        console.log(); // trailing newline
      }

      console.log(`  (${elapsed}ms)`);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
    }

    rl.prompt();
  });

  rl.on('close', async () => {
    await sdk.disconnect();
    process.exit(0);
  });
}

// ========== 主入口 ==========

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  if (args.version) {
    showVersion();
    process.exit(0);
  }

  // 合并环境变量和命令行参数
  const serverUrl =
    args.server || process.env.AGENT_BROWSER_SERVER || 'http://localhost:3100';
  const token = args.token || process.env.AGENT_BROWSER_TOKEN;
  const type = args.type || 'agent-browser';

  // 创建 SDK 实例
  const sdk = new AgentBrowserSdk({
    serverUrl,
    token,
    debug: args.debug,
  });

  // 连接
  console.log(`Connecting to ${serverUrl}...`);

  try {
    const { connectionId, browserReady } = await sdk.connect();
    console.log(`Connected!`);
    console.log(`  Connection ID: ${connectionId}`);
    console.log(`  Browser Ready: ${browserReady}`);
    console.log(`  Engine Type:   ${type}`);
    console.log();
  } catch (err) {
    console.error(
      `Connection failed: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }

  // 根据模式执行
  try {
    if (args.command) {
      // 单命令模式
      await runSingleCommand(sdk, args.command, type, !!args.noStream);
      await sdk.disconnect();
    } else if (args.file) {
      // 文件批量模式
      await runBatchFromFile(sdk, args.file, type);
      await sdk.disconnect();
    } else if (args.interactive) {
      // 交互式模式
      await runInteractive(sdk, type, !!args.noStream);
      // runInteractive 会自己处理退出
    } else {
      // 无命令 → 仅连接测试
      console.log('Connection test successful!');
      console.log('Use -c <command> to execute a command, or -i for interactive mode.');
      console.log('Use --help for more options.');
      await sdk.disconnect();
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    await sdk.disconnect();
    process.exit(1);
  }
}

main();
