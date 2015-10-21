var express = require('express');
var router = express.Router();

var proxy = function (app) {
	// import Seed ProxyConfig
	var ProxyConfig = require('./jello')(app, router);
	
	// config server api seed 
	//var proxy = ProxyConfig.host('lehi.levp-tech.cn').protocol('https');
	var proxy = ProxyConfig.host('www.baidu.com').protocol('https');
	
	// backend api index
	var proxyApiIndex = proxy.api('/home/msg/data/personalcontent');
	var local = ProxyConfig.pathname('/index').api().map(proxyApiIndex);
	console.log(local.toUrlString(), '<--->', proxyApiIndex.toUrlString());

	return router;
}

module.exports = proxy;
