'use strict';

module.exports = ({
  console,
  fs,
  http,
  https,
  httpolyglot,
  localTunnel,
  nodeStatic,
  path,
}) => ({
  dir,
  tlsConfig,
  tunnel,
  ports,
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

  if (ports.length === 1 && ports[0] === 443 && tunnel) {
    console.log('tunnel requires http, adding unspecified port for http that will be chosen by os');
    ports.unshift(0);
  }

  const annotatedServers = ports
    .map((maybePort) => {
      let usingHttp = false;
      let usingHttps = false;

      if (maybePort === 80) {
        usingHttp = true;
      } else if (maybePort === 443) {
        usingHttps = true;
      } else {
        usingHttp = true;
        usingHttps = !!tlsConfig;
      }

      const server = (() => {
        if (usingHttp && usingHttps) {
          return httpolyglot.createServer(tlsConfig, app);
        }

        if (usingHttp) {
          return http.createServer(app);
        }

        return https.createServer(tlsConfig, app);
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
    server.listen(maybePort || 0, (err) => {
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
