import SSE from 'sse';
import send from 'send';
import path from 'path';
import through from 'through2';
import chokidar from 'chokidar';
import {transformFileSync} from 'babel';
import {once} from './utils';

let INJECTED_CODE = '<script>' + transformFileSync(path.join(__dirname, '/injected.js')).code + '</script>';
const rootFolder = 'client';

const connectSSE = once((server, {root}) => {
	console.log(server)
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
});

const middleware = ({root}) => (req, res, next) => {

	connectSSE(req.client.server, {root});

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

export default ({root = rootFolder} = {}) => {
	return middleware({root});
};
