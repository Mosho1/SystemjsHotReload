import SSE from 'sse';
import http from 'http';
import finalhandler from 'finalhandler';
import serveStatic from 'serve-static';
import send from 'send';
import fs from 'fs';
import path from 'path';
import open from 'open';
import through from 'through2';
import chokidar from 'chokidar';
import {transformFileSync} from 'babel';

const INJECTED_CODE = '<script>' + transformFileSync(path.join(__dirname, '/injected.js')).code + '</script>';
const index = ['index.html', 'index.htm'];
const rootFolder = 'client';

const middleware = (req, res, next) => {
	if (req.method !== 'GET' && req.method !== 'HEAD') {
		return next();
	}
	if (req.url !== '/') return next();
	send(req, req.url, {root: path.join(process.cwd(), rootFolder)})
		.on('stream', stream => {
			const len = INJECTED_CODE.length + res.getHeader('Content-Length');
			res.setHeader('Content-Length', len);
			const originalPipe = stream.pipe.bind(stream);
			stream.pipe = response =>
				originalPipe(through(function(chunk, encoding, cb) {
					const newContents = chunk.toString().replace(/<script\s+src.*system(\.src)?\.js.*<\/script>/, m => m + INJECTED_CODE);
					this.push(new Buffer(newContents));
					cb();
				}))
				.pipe(response);
		})
		.pipe(res);
};

const eventServer = http.createServer((req, res) => {
	res.writeHead(200, {'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': true});
	res.end('okay');
});

const serve = serveStatic('client', {index});
const fileServer = http.createServer((req, res) => {
  middleware(req, res, () => {
		const done = finalhandler(req, res);
		serve(req, res, done);
  });
});

fileServer.listen(8090);

const connectSSE = server => () => {
	const sse = new SSE(server);
	sse.on('connection', client => {
		chokidar
			.watch('client', {ignored: /jspm_packages/})
			.on('change', p =>
				client.send({
					event: 'changed',
					data: path.relative(rootFolder, p)
				}));
	});
};

eventServer.listen(8091, connectSSE(eventServer));
