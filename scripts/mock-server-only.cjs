const Module = require('module');
const orig = Module._extensions['.js'];
Module._extensions['.js'] = function(module, filename) {
  if (filename.includes('server-only') && filename.endsWith('index.js')) {
    module.exports = {};
    return;
  }
  return orig.apply(this, arguments);
};
