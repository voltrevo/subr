#!/usr/bin/env node

'use strict';

const path = require('path');

const argv = process.argv;
argv[1] = path.basename(argv[1]);

const { _: [, , dir = '.'], key, cert, tunnel, port: argvPort } = require('yargs')
  .usage('Usage: $0 [dir] [options]')
  .example('$0', 'Connects ./* to http://*.localtest.me:<random>')
  .example('$0 sockets', 'Connects ./sockets/* to http://*.localtest.me:<random>')
  .example('$0 -p 80,443 -k <key> -c <cert>', 'Connects ./* to http(s)://*.localtest.me')
  .example('$0 -p 1234 -k <key> -c <cert>', 'Connects ./* to http(s)://*.localtest.me:1234')
  .example('$0 -t bob.tunnelprovider.com', 'Connects ./* to http(s)://*.bob.tunnelprovider.com')
  .alias('p', 'port')
  .describe('p', 'Port(s) to use, comma separated')
  .alias('k', 'key')
  .describe('k', 'File containing ssl key')
  .alias('c', 'cert')
  .describe('c', 'File containing ssl cert')
  .alias('t', 'tunnel')
  .describe('t', 'Tunnel to request')
  .help('h')
  .alias('h', 'help')
  .wrap(100)
  .parse(argv)
;

const subr = require('.');

subr({
  dir,
  key,
  cert,
  tunnel,
  argvPort,
});
