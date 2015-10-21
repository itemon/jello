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

	// no backend, just an page
	local = Jello.page('/thanks').map();
	console.log(local.toUrlString());

	// with backend api index
	local = Jello.page('/3q').render('thanks').map(proxyIndexApi);
	console.log(local.toUrlString(), '<--->', proxyIndexApi.toUrlString());

	//console.log(router);

	return router;
}

module.exports = proxy;
