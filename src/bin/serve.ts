#!/usr/bin/env node
/**
 * Bin entrypoint for the `grill-board` package.
 *
 * Routes subcommands:
 *   grill-board init   — register MCP + install skill in detected agent clients
 *   grill-board        — (future) start the server
 */

import { init } from './init.js';

const subcommand = process.argv[2];

switch (subcommand) {
  case 'init':
    init();
    break;

  case undefined:
    console.log('Usage: grill-board <command>\n');
    console.log('Commands:');
    console.log('  init    Register MCP server and install skill in detected agent clients');
    break;

  default:
    console.error(`Unknown command: ${subcommand}`);
    console.error('Run `grill-board` without arguments to see available commands.');
    process.exit(1);
}
