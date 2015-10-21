var express = require('express');
var router = express.Router();

var proxy = function (app) {
	// import Seed Jello
	var Jello = require('./jello')(app, router);
	
	// config server api seed 
	//var proxy = Jello.host('lehi.levp-tech.cn').protocol('https');
	var proxy = Jello.host('www.baidu.com').protocol('https');
	
	// backend api index
	var proxyIndexApi = proxy.api('/home/msg/data/personalcontent');
	var local = Jello.pathname('/index').api().map(proxyIndexApi);
	console.log(local.toUrlString(), '<--->', proxyIndexApi.toUrlString());

	return router;
}

module.exports = proxy;
