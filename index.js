#!/usr/bin/env node

'use strict';

const { _: [dir = '.'], key, cert, tunnel, port: argvPort } = require('yargs')
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
  .argv
;

const fs = require('fs');
const http = require('http');
const https = require('https');
const httpolyglot = require('httpolyglot');
const once = require('lodash/once');
const path = require('path');

const localTunnel = require('localtunnel');

const app = (req, res) => {
  const urlParts = req.url.split('/');

  const domainLevels = req.headers.host.split('.');

  const sockName = domainLevels[0];

  const sockReq = http.request({
    socketPath: `${dir}/${sockName}`,
    method: req.method,
    path: req.url,
    headers: req.headers
  }, (sockRes) => {
    res.statusCode = sockRes.statusCode;
    res.statusMessage = sockRes.statusMessage;
    for (const headerKey of Object.keys(sockRes.headers)) {
      res.setHeader(headerKey, sockRes.headers[headerKey]);
    }
    sockRes.pipe(res);
  });

  req.pipe(sockReq);

  sockReq.addListener('error', (err) => {
    console.error(err);
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end(`Couldn\'t find socket: ${sockName}`);
  });
};

const tlsConf = once(() => ({
  key: fs.readFileSync(key),
  cert: fs.readFileSync(cert),
}));

const maybePorts = (argvPort ? String(argvPort).split(',').map(Number) : [undefined]);

if (maybePorts.length === 1 && maybePorts[0] === 443 && tunnel) {
  console.log('tunnel requires http, adding unspecified port for http that will be chosen by os');
  maybePorts.unshift(undefined);
}

const annotatedServers = maybePorts
  .map(maybePort => {
    let usingHttp = false;
    let usingHttps = false;

    if (maybePort === 80) {
      usingHttp = true;
    } else if (maybePort === 443) {
      usingHttps = true;
    } else {
      usingHttp = true;
      usingHttps = (key && cert);
    }

    const server = (() => {
      if (usingHttp && usingHttps) {
        return httpolyglot.createServer(tlsConf(), app);
      }

      if (usingHttp) {
        return http.createServer(app);
      }

      return https.createServer(tlsConf(), app);
    })();

    return {
      maybePort,
      usingHttp,
      usingHttps,
      server,
    };
  })
;

console.log(`Connecting sockets at ${path.join(dir, '*')} to:`);

annotatedServers.forEach(({ maybePort, usingHttp, usingHttps, server }, i) => {
  server.listen(maybePort, (err) => {
    if (err) {
      throw err;
    }

    const port = server.address().port;

    if (usingHttp) {
      const portSuffix = (port === 80 ? '' : `:${port}`);
      console.log(`- http:/\/\*.localtest.me${portSuffix}`);
    }

    if (usingHttps) {
      const portSuffix = (port === 443 ? '' : `:${port}`);
      console.log(`- https:/\/\*.localtest.me${portSuffix}`);
    }

    if (i !== 0 || !tunnel) {
      return;
    }

    const [subdomain, ...domainTail] = tunnel.split('.');
    const host = `http://${domainTail.join('.')}`;

    localTunnel(port, { subdomain, host }, (err, { url }) => {
      if (err) {
        throw err;
      }

      const remoteWildcard = url.replace(/^https?:\/\//, '*.');

      console.log(`- http://${remoteWildcard}`);
      console.log(`- https://${remoteWildcard}`);
    });
  });
});
