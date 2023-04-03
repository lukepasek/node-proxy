const http = require('http');
const fs = require('fs')
const path = require('path')

const port = 3031;
const cache_404 = false;

var requests = 0;

function red(message) {
  return '\u001b[31m' + message + '\u001b[0m';
}

function green(message) {
  return '\u001b[32m' + message + '\u001b[0m';
}

function yellow(message) {
  return '\u001b[33m' + message + '\u001b[0m';
}

function blue(message) {
  return '\u001b[34m' + message + '\u001b[0m';
}

const keepAliveAgent = new http.Agent({ keepAlive: true });
var server_options = {
  agent: keepAliveAgent
};
server = http.createServer(server_options, onRequest)
server.keepAliveTimeout = (60 * 1000) + 1000;
server.headersTimeout = (60 * 1000) + 2000;
server.on('request', () => {requests++});
server.listen(port);

console.log(yellow('===== Simple HTTP proxy listening on: ' + port+' ====='));

function onRequest(client_req, client_res) {
  const method = client_req.method;
  const hostname = 'artifactory.kmd.dk';
  const request_path = client_req.url;
  const cache_path = './cache/node_http_proxy/cached/'+request_path;
  const cache_nf_path = './cache/node_http_proxy/not_found/'+request_path;
  const cached_headers = {
            server: 'Node.js Http proxy',
            // "Content-Type": "application/json",
            'keep-alive': 'timeout=5, max=10000',
            connection: 'Keep-Alive',
            "Content-Length": 0
          };

  console.log('REQ '+requests+': '+method+' '+'http://' + hostname + request_path);

  if (cache_404) {
    try {
      if (fs.existsSync(cache_path)) {
        console.log("cached file exists: "+cache_path);
      } else if (fs.existsSync(cache_nf_path)) {
          console.log(yellow(method+' '+'http://' + hostname + request_path +' '+404+' (cached)'));
          client_res.writeHead(404, cached_headers);
          client_res.end();
          requests_end++;
          return;
      }
    } catch(err) {
      console.error(err)
    }
  }

  var options = {
    hostname: 'HOSTNAME_HERE',
    port: 80,
    path: client_req.url,
    method: client_req.method,
    headers: client_req.headers,
    timeout: 300,
    agent: keepAliveAgent,
    protocol: "http"
  };
  options.headers.host = options.hostname;

  var proxy = http.request(options, (res) => {
    // console.log(blue('Connection: '+res.headers.connection+", "+res.headers['keep-alive']));
    if (res.statusCode==200) {
      console.log(green(options.method+' '+options.protocol+'://' + options.hostname + options.path+' '+res.statusCode));
    } else {
      console.log(red(options.method+' '+options.protocol+'://' + options.hostname + options.path+' '+res.statusCode));
      if (cache_404 && res.statusCode == 404) {
        fs.mkdirSync(path.dirname(cache_nf_path), { recursive: true });
        fs.closeSync(fs.openSync(cache_nf_path, 'w'))
      }
    }
    res.on('end', () => {});

    res.headers['keep-alive'] = 'timeout=60';
    res.headers.connection = 'Keep-Alive';
    client_res.writeHead(res.statusCode, res.headers);
    res.pipe(client_res, {
      end: true
    });
  });

  proxy.on('error', (e) => {
    console.error(red(`problem with request: ${e.message}`));
  });

  proxy.on('socket', (s) => {
    // console.log(blue(`socket event: ${s}`));
  });

  client_req.pipe(proxy, {
    end: true
  });
}
