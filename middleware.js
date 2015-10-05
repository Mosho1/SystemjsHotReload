import SSE from 'sse';
import http from 'http';
import send from 'send';
import path from 'path';
import through from 'through2';
import chokidar from 'chokidar';
import {transformFileSync} from 'babel';

let INJECTED_CODE = '<script>' + transformFileSync(path.join(__dirname, '/injected.js')).code + '</script>';
const rootFolder = 'client';
let ssePort = 8091;

const middleware = ({root}) => (req, res, next) => {
	if (req.method !== 'GET' && req.method !== 'HEAD') {
		return next();
	}
	if (req.url !== '/') {
		return next();
	}
	send(req, req.url, {root: path.join(process.cwd(), root)})
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

const connectSSE = (server, {root}) => () => {
	const sse = new SSE(server);
	sse.on('connection', client => {
		chokidar
			.watch('client', {ignored: /jspm_packages/})
			.on('change', p =>
				client.send({
					event: 'changed',
					data: path.relative(root, p)
				}));
	});
};

export default ({port = ssePort, root = rootFolder} = {}) => {
	INJECTED_CODE = INJECTED_CODE.replace('{{port}}', port);
	eventServer.listen(ssePort, connectSSE(eventServer, {root}));
	return middleware({root});
};
