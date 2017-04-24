'use strict';

const fs = require('fs');
const http = require('http');

const httpolyglot = require('httpolyglot');
const argv = require('yargs').argv;

const certDir = argv['cert-dir'];
const dir = argv.dir || '.';
const port = argv.port || 8080;

const app = (req, res) => {
  const urlParts = req.url.split('/');

  const sockName = urlParts[1];

  if (!sockName) {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Couldn\'t find socket to route for ' + req.url);
    return;
  }

  const tailUrl = '/' + urlParts.slice(2).join('/');

  const sockReq = http.request({
    socketPath: `${dir}/${sockName}`,
    method: req.method,
    path: tailUrl,
    headers: req.headers
  }, (sockRes) => {
    sockRes.pipe(res);
  });

  req.pipe(sockReq);

  sockReq.addListener('error', (err) => {
    console.error(err);
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Couldn\'t find socket to route for ' + req.url);
  });
};

const server = (() => {
  if (!certDir) {
    console.log('--cert-dir not provided, using http only');
    return http.createServer(app);
  }

  return httpolyglot.createServer({
    key: fs.readFileSync(`${certDir}/localhost.key`),
    cert: fs.readFileSync(`${certDir}/localhost.crt`),
  }, app);
})();

server.listen(port);
