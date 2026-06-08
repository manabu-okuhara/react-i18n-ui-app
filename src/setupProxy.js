const express = require('express');
const { handleTranslateLocaleBundleRequest } = require('../server/translateLocaleBundle');
const { handleEvaluateLocaleBundleRequest } = require('../server/evaluateLocaleBundle');

module.exports = function setupProxy(app) {
  app.use(
    '/api/translate-locale-bundle',
    express.json(),
    (req, res) => {
      handleTranslateLocaleBundleRequest(req, res);
    }
  );

  app.use(
    '/api/evaluate-locale-bundle',
    express.json(),
    (req, res) => {
      handleEvaluateLocaleBundleRequest(req, res);
    }
  );
};
