# subr
> A subdomain router.

## Install
```sh
npm install -g subr
```

## Usage
```sh
subr -h
```

```
Usage: subr [dir] [options]

Options:
  -p, --port    Port(s) to use, comma separated
  -k, --key     File containing ssl key
  -c, --cert    File containing ssl cert
  -t, --tunnel  Tunnel to request
  -h, --help    Show help                                                                  [boolean]

Examples:
  subr                               Connects ./* to http://*.localtest.me:<random>
  subr sockets                       Connects ./sockets/* to http://*.localtest.me:<random>
  subr -p 80,443 -k <key> -c <cert>  Connects ./* to http(s)://*.localtest.me
  subr -p 1234 -k <key> -c <cert>    Connects ./* to http(s)://*.localtest.me:1234
  subr -t bob.tunnelprovider.com     Connects ./* to http(s)://*.bob.tunnelprovider.com
```

## Example
The idea is for your http servers to listen on unix domain sockets. Nodejs allows you to do this simply by specifying a filesystem path where you would usually specify a port. The http library will create the unix domain socket for you:

```js
// hello.js

'use strict';

const fs = require('fs');
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello World\n');
});

const path = `./sockets/hello`;

server.listen(path, (err) => {
  if (err) {
    throw err;
  }

  console.log(`Server running at ${path}`);

  // If you don't do this, you'll get EADDRINUSE after the first run because
  // the file will still be there after this process exits.
  process.on('SIGINT', () => { server.close(); });
});
```

```sh
mkdir -p sockets
node hello.js &
subr sockets -p 8080 &
```

Then go to http://hello.localtest.me:8080.

Don't forget to cleanup:

```
$ jobs
[1]-  Running                 node hello.js &
[2]+  Running                 subr sockets -p 8080 &
$ kill %1 %2
$ rmdir sockets
```

## Static Content
If a directory is encountered instead of a socket, it will be served statically:

```sh
mkdir -p sockets
subr sockets -p 8080 &
mkdir sockets/static
echo 'Hello world!' >sockets/static/index.html
curl static.localtest.me:8080
# output: Hello world!
```

## API
You can also require `subr` instead of using the cli:

```sh
npm install --save subr
```

```js
'use strict';

const fs = require('fs');
const subr = require('subr');

subr({
  // Directory to look for sockets/static directories:
  // Default: .
  dir: '.',

  // Config for https:
  // Default: omit tlsConfig
  tlsConfig: {
    key: fs.readFileSync('path/to/server.key'),
    cert: fs.readFileSync('path/to/server.crt'),
  },

  // Tunnel to request (default omits this):
  // Default: omit tunnel
  tunnel: 'bob.tunnelprovider.com',

  // Ports to use, 0 meaning random port:
  // Default: [0]
  ports: [80, 443],
});
```
