var express = require('express');
var router = express.Router();

var proxy = function (app) {
	// import Seed ProxyConfig
	var ProxyConfig = require('./proxy_config')(app, router);
	
	// config server api seed 
	var proxy = ProxyConfig.host('lehi.levp-tech.cn').protocol('https');
	
	// api rest 1
	var proxyApiIndex = proxy.api('rest/1');
	var local = ProxyConfig.pathname('/genius').api().map(proxyApiIndex);
	console.log(local.toUrlString(), '---', proxyApiIndex.toUrlString());

	return router;
}

module.exports = proxy;
