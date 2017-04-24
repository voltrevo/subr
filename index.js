'use strict';

const fs = require('fs');
const http = require('http');

const httpolyglot = require('httpolyglot');
const argv = require('yargs').argv;

const certDir = (
  process.env.CERT_DIR ||
  argv['cert-dir'] ||
  (() => { throw new Error('Need certificates from CERT_DIR or --cert-dir'); })
);

const dir = argv._[0] || '.';
const port = argv.port || 8080;

const server = httpolyglot.createServer({
  key: fs.readFileSync(`${certDir}/localhost.key`),
  cert: fs.readFileSync(`${certDir}/localhost.crt`),
}, (req, res) => {
  if (req.url.indexOf('/foobar') === 0) {
    const sockReq = http.request({
      socketPath: `${dir}/foobar`,
      method: req.method,
      path: '/' + req.url.substring('/foobar'.length),
      headers: req.headers
    }, (sockRes) => {
      console.log('Got response from unix socket');
      sockRes.pipe(res);
    });

    req.pipe(sockReq);
  } else {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Couldn\'t find socket to route for', req.url);
  }
});

server.listen(port);
