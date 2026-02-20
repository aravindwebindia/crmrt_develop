const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost/crmrt_live2/backend',
      changeOrigin: true,
      secure: false,
      logLevel: 'debug',
      onProxyReq: (proxyReq, req, res) => {
        },
      onProxyRes: (proxyRes, req, res) => {
        },
      onError: (err, req, res) => {
        res.writeHead(500, {
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({
          success: false,
          message: 'Proxy error: ' + err.message
        }));
      }
    })
  );
};
