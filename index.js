import SSE from 'sse';
import http from 'http';
import finalhandler from 'finalhandler';
import serveStatic from 'serve-static';
import systemJSMiddeware from './middleware';

const root = 'client';

const middleware = systemJSMiddeware({root});

const index = ['index.html', 'index.htm'];

const serve = serveStatic(root, {index});
const fileServer = http.createServer((req, res) => {
  middleware(req, res, () => {
		const done = finalhandler(req, res);
		serve(req, res, done);
  });
});

fileServer.listen(8090);

