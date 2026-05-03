const express = require('express');
const { handleTranslateLocaleBundleRequest } = require('../server/translateLocaleBundle');

module.exports = function setupProxy(app) {
  app.use(
    '/api/translate-locale-bundle',
    express.json(),
    (req, res) => {
      handleTranslateLocaleBundleRequest(req, res);
    }
  );
};
