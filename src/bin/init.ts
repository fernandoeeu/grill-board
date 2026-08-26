/**
 * `grill-board init` — detect agent clients, register MCP, install skill.
 *
 * Checks the filesystem for known agent client directories, writes the MCP
 * server entry into each detected client's configuration, and copies the
 * bundled grill-board skill file into the agent's skill directory.
 *
 * Idempotent: running twice produces the same result with no duplicates.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentClient {
  name: string;
  /** Directory whose existence signals the client is installed. */
  detectDir: string;
  /** Path to the JSON config file where MCP servers are registered. */
  mcpConfigPath: string;
  /** JSON key that holds the MCP server map (e.g. "mcpServers"). */
  mcpConfigKey: string;
  /** Directory where skill markdown files are installed. */
  skillDir: string;
}

interface InitResult {
  client: string;
  mcpRegistered: boolean;
  skillInstalled: boolean;
  /** true when the entry already existed and was left untouched. */
  mcpAlreadyPresent: boolean;
  skillAlreadyPresent: boolean;
}

// ---------------------------------------------------------------------------
// MCP server entry — frozen contract
// ---------------------------------------------------------------------------

const MCP_SERVER_ENTRY = {
  command: 'npx',
  args: ['grill-board'],
} as const;

const MCP_SERVER_NAME = 'grill-board';
const SKILL_FILENAME = 'grill-board.md';

// ---------------------------------------------------------------------------
// Bundled skill resolution
// ---------------------------------------------------------------------------

function bundledSkillPath(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  // In source: src/bin/init.ts -> src/skill/grill-board.md
  // At runtime the relative path is the same regardless of transpilation.
  return join(thisDir, '..', 'skill', SKILL_FILENAME);
}

// ---------------------------------------------------------------------------
// Client detection
// ---------------------------------------------------------------------------

function buildClients(home: string): AgentClient[] {
  return [
    {
      name: 'Claude Code',
      detectDir: join(home, '.claude'),
      mcpConfigPath: join(home, '.claude.json'),
      mcpConfigKey: 'mcpServers',
      skillDir: join(home, '.claude', 'skills'),
    },
    // opencode and Codex stubs — detection directories TBD; they will never
    // match until the directories are known, which keeps the exit-code
    // contract intact ("0 with message if no clients detected").
  ];
}

// ---------------------------------------------------------------------------
// JSON config helpers
// ---------------------------------------------------------------------------

function readJsonFile(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, 'utf-8').trim();
  if (raw === '') return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function writeJsonFile(path: string, data: Record<string, unknown>): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

function registerMcp(client: AgentClient): { registered: boolean; alreadyPresent: boolean } {
  const config = readJsonFile(client.mcpConfigPath);
  const servers = (config[client.mcpConfigKey] ?? {}) as Record<string, unknown>;

  if (servers[MCP_SERVER_NAME] !== undefined) {
    return { registered: false, alreadyPresent: true };
  }

  servers[MCP_SERVER_NAME] = { ...MCP_SERVER_ENTRY };
  config[client.mcpConfigKey] = servers;
  writeJsonFile(client.mcpConfigPath, config);
  return { registered: true, alreadyPresent: false };
}

function installSkill(client: AgentClient): { installed: boolean; alreadyPresent: boolean } {
  const dest = join(client.skillDir, SKILL_FILENAME);

  if (existsSync(dest)) {
    return { installed: false, alreadyPresent: true };
  }

  if (!existsSync(client.skillDir)) {
    mkdirSync(client.skillDir, { recursive: true });
  }

  const src = bundledSkillPath();
  const content = readFileSync(src, 'utf-8');
  writeFileSync(dest, content, 'utf-8');
  return { installed: true, alreadyPresent: false };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface InitOptions {
  /** Override home directory (for testing). Defaults to os.homedir(). */
  home?: string;
}

export function init(options: InitOptions = {}): void {
  const home = options.home ?? homedir();
  const clients = buildClients(home);
  const detected: AgentClient[] = clients.filter((c) => existsSync(c.detectDir));

  if (detected.length === 0) {
    console.log('No agent clients detected.');
    console.log(
      'Looked for: ' + clients.map((c) => `${c.name} (${c.detectDir})`).join(', ') + '.',
    );
    console.log('Install an agent client and run `grill-board init` again.');
    return;
  }

  const results: InitResult[] = [];

  for (const client of detected) {
    const mcp = registerMcp(client);
    const skill = installSkill(client);
    results.push({
      client: client.name,
      mcpRegistered: mcp.registered,
      skillInstalled: skill.installed,
      mcpAlreadyPresent: mcp.alreadyPresent,
      skillAlreadyPresent: skill.alreadyPresent,
    });
  }

  // Summary
  console.log('grill-board init complete.\n');
  for (const r of results) {
    console.log(`  ${r.client}:`);
    if (r.mcpRegistered) {
      console.log('    MCP server registered.');
    } else if (r.mcpAlreadyPresent) {
      console.log('    MCP server already registered (skipped).');
    }
    if (r.skillInstalled) {
      console.log('    Skill installed.');
    } else if (r.skillAlreadyPresent) {
      console.log('    Skill already installed (skipped).');
    }
  }
}
