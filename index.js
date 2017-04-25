'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const httpolyglot = require('httpolyglot');
const once = require('lodash/once');

const localTunnel = require('localtunnel');
const argv = require('yargs').argv;

const dir = argv.dir || '.';

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
  key: fs.readFileSync(argv.key),
  cert: fs.readFileSync(argv.cert),
}));

const maybePorts = (argv.port ? String(argv.port).split(',').map(Number) : [undefined]);

if (maybePorts.length === 1 && maybePorts[0] === 443 && argv.tunnel) {
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
      usingHttps = (argv.key && argv.cert);
    }

    const server = (() => {
      if (usingHttp && usingHttps) {
        return httpolyglot.createServer(tlsConf(), app);
      }

      if (usingHttp) {
        return http.createServer(app);
      }

      // TODO: try using only https with tunnel
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

annotatedServers.forEach(({ maybePort, usingHttp, usingHttps, server }, i) => {
  server.listen(maybePort, (err) => {
    if (err) {
      throw err;
    }

    const port = server.address().port;

    if (usingHttp) {
      const portSuffix = (port === 80 ? '' : `:${port}`);
      console.log(`http:/\/\*.localtest.me${portSuffix} connected to sockets ${dir}/\*`);
    }

    if (usingHttps) {
      const portSuffix = (port === 443 ? '' : `:${port}`);
      console.log(`https:/\/\*.localtest.me${portSuffix} connected to sockets ${dir}/\*`);
    }

    if (i !== 0 || !argv.tunnel) {
      return;
    }

    const [subdomain, ...domainTail] = argv.tunnel.split('.');
    const host = `http://${domainTail.join('.')}`;

    localTunnel(port, { subdomain, host }, (err, tunnel) => {
      if (err) {
        throw err;
      }

      const remoteWildcard = tunnel.url.replace(/^https?:\/\//, '*.');

      console.log(`http://${remoteWildcard} connected to sockets ${dir}/*`);
      console.log(`https://${remoteWildcard} connected to sockets ${dir}/*`);
    });
  });
});
