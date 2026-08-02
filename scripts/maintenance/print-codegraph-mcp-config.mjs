import os from 'node:os';
import path from 'node:path';

const codegraphVersion = '1.5.0';
const configPath = path.join(os.homedir(), '.codex', 'config.toml');

process.stdout.write([
  `# Add to ${configPath}`,
  '',
  '[mcp_servers.codegraph]',
  'command = "npx"',
  `args = ["--yes", "@colbymchenry/codegraph@${codegraphVersion}", "serve", "--mcp"]`,
  '',
].join('\n'));
