var urler = require('url');
var express = require('express');

//TODO injecting global variable, imporving this later
var app, router;

/****
 * base class
 */
var ProxyConfigBase = function () {
	this._httpConf = {};
	this._method = ProxyConfigBase.METHOD_GET;
};

ProxyConfigBase.METHOD_GET = 0;
ProxyConfigBase.METHOD_POST = 1;
ProxyConfigBase.METHOD_PUT = 2;

ProxyConfigBase.PATTERN_PATH = /^[\w_\/]+$/gi;
ProxyConfigBase.prototype = {
	host: function (host) {
		if (typeof host !== 'undefined') {
			this._httpConf.host = host;
		}
		return this;
	},
	protocol: function (protocol) {
		if (typeof protocol !== 'undefined') {
			this._httpConf.protocol = protocol;
		}
		return this;
	},
	get: function () {
		this._method = ProxyConfigBase.METHOD_GET;
		return this;
	},
	post: function () {
		this._method = ProxyConfigBase.METHOD_POST;
		return this;
	},
	put: function () {
		this._method = ProxyConfigBase.METHOD_PUT;
		return this;
	},
	pathname: function (pathname) {
		if (typeof pathname !== 'undefined') {
			var pattern = ProxyConfigBase.PATTERN_PATH;
			pattern.lastIndex = 0;
			if (!pattern.test(pathname)) {
				throw new TypeError('pathname format error, only \'0-9, a-z, A-Z, _\' allowed');
			}
			this._httpConf.pathname = pathname;
		}
		return this;
	},
	toUrlString: function () {
		return urler.format(this._httpConf);
	},
	getConf: function () {
		return this._httpConf;
	}
}


/**
 * ProxyConfig is an http url config object representing all http component
 * it can factorying an http request instance
 */
var ProxyConfig = function () {
	ProxyConfigBase.call(this);
}
ProxyConfig._handleCall = function (/**host, arg1, arg2**/) {
	var args = Array.prototype.slice.call(arguments, 0);
	if (args.length < 2) {
		throw new Error('have you forgot to pass in host argument?');
	}
	var host = args[0];
	var method = args[1];
	var otherArgs = args.slice(2);

	var proto = ProxyConfigBase.prototype[method];
	//if (typeof proto == 'undefined')
	//	proto = ProxyConfig.prototype[method];

	if (host instanceof ProxyConfig) {
		proto.apply(host, otherArgs);
		return this;
	} else {
		var instance = new ProxyConfig();
		proto.apply(instance, otherArgs);
		return instance;
	}
}
ProxyConfig.host = function (host) {
	return ProxyConfig._handleCall(this, 'host', host);
}
ProxyConfig.protocol = function (protocol) {
	return ProxyConfig._handleCall(this, 'protocol', protocol);
}
ProxyConfig.pathname = function (pathname) {
	return ProxyConfig._handleCall(this, 'pathname', pathname);
}
ProxyConfig.get = function () {
	return ProxyConfig._handleCall(this, 'get');
}
ProxyConfig.post = function () {
	return ProxyConfig._handleCall(this, 'post');
}
ProxyConfig.put = function () {
	return ProxyConfig._handleCall(this, 'put');
}

/****
 * fast creation method
 */
ProxyConfig._handleCallEx = function (/*arg1, arg2, arg3*/) {
	var args = Array.prototype.slice.call(arguments, 0);
	if (args.length < 2) {
		throw new Error('have you forgot to pass in host argument?');
	}
	var host = args[0];
	var method = args[1];
	var otherArgs = args.slice(2);

	var proto = ProxyConfig.prototype[method];
	return proto.apply(host, otherArgs);
}
ProxyConfig.api = function (path) {
	return ProxyConfig._handleCallEx(this, 'api', path);
}
ProxyConfig.page = function (path) {
	return ProxyConfig._handleCallEx(this, 'page', path);
}

ProxyConfig.prototype = {
	__proto__: ProxyConfigBase.prototype,
	api: function (path) {
		var apiRequest = new ApiHttpRequest(this);
		if (typeof path === 'string') {
			apiRequest.pathname(path);
		}
		return apiRequest;
	},
	page: function (path) {
		var pageRequest = new PageHttpRequest(this);
		if (typeof path === 'string') {
			pageRequest.pathname(path);
		}
		return pageRequest;
	}
}

/**
 *base http request
 */
var HttpRequest = function (proxyConfig) {
	ProxyConfigBase.call(this);
	if (proxyConfig instanceof ProxyConfigBase) {
		this.fromConfig(proxyConfig.getConf());
	}
	this._targetRequests = null;
	this._app = null;
}
HttpRequest.prototype = {
	__proto__: ProxyConfigBase.prototype,
	fromConfig: function (conf) {
		for (var i in conf) {
			if (conf.hasOwnProperty(i)) {
				this._httpConf[i] = conf[i];
			}
		}
	},
	/***
	 * inject an app instance
	 */
	inject: function (app) {
	},
	map: function (/*arg1, arg2, arg3, arg4*/request) {
		// do you really want to call this?
	},
	_checkMapRequest: function (args) {
		var argLen = args.length;
		for (var i = 0; i<argLen; i++) {
			this._checkSingle(args[i]);
		}
		return args;
	},
	_checkSingle: function (request) {
		var url = request.toUrlString();
		var selfUrl = this.toUrlString();
		if (!(request instanceof ApiHttpRequest)) {
			throw new TypeError('You can not map ' + url + ' from '+selfUrl+', it is not an instance of ApiHttpRequest');
		}
	},
	_checkLocal: function () {
		if (typeof this._httpConf.host === 'string' 
				|| typeof this._httpConf.protocol === 'string' 
				|| typeof this._httpConf.port === 'string') {
				throw new TypeError('Local HttpRequest is not allowed to set \'protocol, host, port\'');
		}
	}
}

/**
 * page request
 */
var PageHttpRequest = function (proxyConfig) {
	HttpRequest.call(this, proxyConfig);
	this._renderFile = null;
}
PageHttpRequest.prototype = {
	__proto__: HttpRequest.prototype,
	render: function (file) {
		return this;
	},
	map: function (/*arg1, arg2, arg3, arg4*/httpRequest) {
		var args = Array.prototype.slice.call(arguments, 0);
		var reqs = this._checkMapRequest(args);
		this._targetRequests = reqs;
		return this;
	}
}

/**
 * api request
 */
var ApiHttpRequest = function (proxyConfig) {
	HttpRequest.call(this, proxyConfig);
}
ApiHttpRequest.prototype = {
	__proto__: HttpRequest.prototype,
	map: function (/*arg1, arg2, arg3, arg4*/httpRequest) {
		this._checkLocal();
		var args = Array.prototype.slice.call(arguments, 0);
		var reqs = this._checkMapRequest(args);
		this._targetRequests = reqs;
		// translate to string http type
		var httpType = this._method == ProxyConfigBase.METHOD_GET ? 'get' : 'post';
		var selfUrl = this.toUrlString();
		// handle as routering
		router[httpType](selfUrl, function (req, resp, next) {
			resp.json({
				hello: 'world'
			});
		});
		router.get('/q3', function (req, resp, next) {
			resp.json({
				q3: true
			});
		});
		return this;
	}
}

/**
 * using injecter to inject global conf
 */
var injecter = function (applicationInstance, routerInstance) {
	//if (app == null || router == null) {
		app = applicationInstance;
		router = routerInstance;
	//}
	return ProxyConfig;
}

exports = module.exports = injecter;
