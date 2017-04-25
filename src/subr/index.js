'use strict';

const once = require('lodash/once');

module.exports = ({
  fs,
  http,
  https,
  httpolyglot,
  localTunnel,
  nodeStatic,
  path,
}) => ({
  dir,
  key,
  cert,
  argvPort,
  tunnel,
}) => {
  const file = new nodeStatic.Server(dir);

  const app = (req, res) => {
    const domainLevels = req.headers.host.split('.');
    const sockName = domainLevels[0];

    fs.stat(`${dir}/${sockName}`, (err, stats) => {
      if (err) {
        console.error(err);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      if (stats.isDirectory()) {
        req.url = `${sockName}/${req.url}`;
        file.serve(req, res);
        return;
      }

      const sockReq = http.request({
        socketPath: `${dir}/${sockName}`,
        method: req.method,
        path: req.url,
        headers: req.headers,
      }, (sockRes) => {
        res.statusCode = sockRes.statusCode;
        res.statusMessage = sockRes.statusMessage;
        for (const headerKey of Object.keys(sockRes.headers)) {
          res.setHeader(headerKey, sockRes.headers[headerKey]);
        }
        sockRes.pipe(res);
      });

      req.pipe(sockReq);

      sockReq.addListener('error', (sockErr) => {
        console.error(sockErr);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Couldn't find socket: ${sockName}`);
      });
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
    .map((maybePort) => {
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
        console.log(`- http://*.localtest.me${portSuffix}`);
      }

      if (usingHttps) {
        const portSuffix = (port === 443 ? '' : `:${port}`);
        console.log(`- https://*.localtest.me${portSuffix}`);
      }

      if (i !== 0 || !tunnel) {
        return;
      }

      const [subdomain, ...domainTail] = tunnel.split('.');
      const host = `http://${domainTail.join('.')}`;

      localTunnel(port, { subdomain, host }, (tunnelErr, { url }) => {
        if (tunnelErr) {
          throw tunnelErr;
        }

        const remoteWildcard = url.replace(/^https?:\/\//, '*.');

        console.log(`- http://${remoteWildcard}`);
        console.log(`- https://${remoteWildcard}`);
      });
    });
  });
};
