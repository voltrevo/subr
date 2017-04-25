'use strict';

const fs = require('fs');
const http = require('http');
const httpolyglot = require('httpolyglot');

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

const server = (() => {
  if (argv.key && argv.cert) {
    return httpolyglot.createServer({
      key: fs.readFileSync(argv.key),
      cert: fs.readFileSync(argv.cert),
    }, app);
  }

  return http.createServer(app);
})();

server.listen(argv.port, (err) => {
  if (err) {
    throw err;
  }

  const port = server.address().port;
  const portSuffix = port === 80 ? '' : `:${port}`;

  console.log(`http:/\/\*.localtest.me${portSuffix} connected to sockets ${dir}/\*`);

  if (!argv.tunnel) {
    return;
  }

  const [subdomain, ...domainTail] = argv.tunnel.split('.');
  const host = `http://${domainTail.join('.')}`;

  localTunnel(port, { subdomain, host }, (err, tunnel) => {
    if (err) {
      throw err;
    }

    console.log(`${tunnel.url.replace(/^https?:\/\//, '*.')} connected to sockets ${dir}/*`);
  });
});
