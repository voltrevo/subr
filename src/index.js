'use strict';

const fs = require('mz/fs');
const http = require('http');
const https = require('https');
const path = require('path');

const httpolyglot = require('httpolyglot');
const localTunnel = require('localtunnel');
const nodeStatic = require('node-static');

const subr = require('./subr/subr.js');

module.exports = subr({
  console,
  fs,
  http,
  https,
  httpolyglot,
  localTunnel,
  nodeStatic,
  path,
});
