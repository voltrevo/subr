# subr

A subdomain router.

```sh
npm install -g subr
```

```sh
subr -h
```

```
Usage: subr [options]

Options:
  -p, --port    Port(s) to use, comma separated
  -d, --dir     Directory to look for unix domain sockets                             [default: "."]
  -k, --key     File containing ssl key
  -c, --cert    File containing ssl cert
  -t, --tunnel  Tunnel to request
  -h, --help    Show help                                                                  [boolean]

Examples:
  subr                               Connects http://*.localtest.me:<random> to ./*
  subr -p 80,443 -k <key> -c <cert>  Connects http(s)://*.localtest.me to ./*
  subr -p 1234 -k <key> -c <cert>    Connects http(s)://*.localtest.me:1234 to ./*
  subr -t bob.tunnelprovider.com     Connects http(s)://*.bob.tunnelprovider.com to ./*
```
