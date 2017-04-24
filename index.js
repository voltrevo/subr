'use strict';

const fs = require('fs');
const http = require('http');

const localTunnel = require('localtunnel');
const argv = require('yargs').argv;

const dir = argv.dir || '.';

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

const server = http.createServer(app);

server.listen((err) => {
  if (err) {
    throw err;
  }

  const port = server.address().port;
  localTunnel(port, { subdomain: argv.subdomain, host: argv.tunnelHost }, (err, tunnel) => {
    if (err) {
      throw err;
    }

    console.log(`forwarding ${tunnel.url.replace(/^https?:\/\//, '*.')} to sockets ${dir}/*`);
  });
});
