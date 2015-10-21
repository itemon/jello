'use strict';

var urler = require('url');
var express = require('express');
var request = require('request');

//TODO injecting global variable, imporving this later
var app, router;

var VERSION = '1.0.0beta';
var NAME = "JELLO";

/****
 * base class
 */
var ProxyConfigBase = function () {
	this._httpConf = {};
	this._method = ProxyConfigBase.METHOD_GET;
	this._usingJsonFormat = true;
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
	getMethod: function () {
		return this._method;
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
	json: function (usingJson) {
		this._usingJsonFormat = usingJson;
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
ProxyConfig.json = function (json) {
	return ProxyConfig._handleCall(this, 'json', json);
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
		// copy main config
		this.fromConfig(proxyConfig.getConf());
		// copy method and other conf
		this._method = proxyConfig._method;
		this._usingJsonFormat = proxyConfig._usingJsonFormat;
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
			throw new TypeError('You can not map ' + url + ' for '+selfUrl+', it is not an instance of ApiHttpRequest');
		}
		if (typeof request._httpConf.host !== 'string') {
			throw new TypeError('you must supply host for '+selfUrl+', without host we can nothing mapping');
		}
	},
	_checkLocal: function () {
		if (typeof this._httpConf.host === 'string' 
				|| typeof this._httpConf.protocol === 'string' 
				|| typeof this._httpConf.port === 'string') {
				throw new TypeError('Local HttpRequest is not allowed to set \'protocol, host, port\'');
		}
	},
	_wrap: function (start, end) {
		var data = Object.create(null);
		data.jello_version = VERSION;
		data.jello_name = NAME;
		if (typeof start == 'number' && typeof end == 'number') {
			data.jello_mapping_cost = (end - start) + "ms";
		}
		return data;
	},
	_doSingleApi: function (req, resp, next, selfMethod, mapping) {
		var url = mapping.toUrlString();
		var method = mapping.getMethod();
		var _this = this;

		switch (method) {
			case ProxyConfigBase.METHOD_GET:
			case ProxyConfigBase.METHOD_POST:
				var _start = new Date().getTime();
				var carryData = {
					url: url,
					headers: {
						cookie: req.headers.cookie,//including cookie
					}
				}
				// bring post data provide in post request and mapping request in post mode
				if (method == ProxyConfigBase.METHOD_POST && selfMethod == ProxyConfigBase.METHOD_POST) {
					carryData.data = req.body;
				}
				var httpType = method == ProxyConfigBase.METHOD_GET ? 'get' : 'post';
				request[httpType](carryData, function(err, httpResponse, body) {
					var data = _this._wrap(_start, new Date().getTime());
					if (err) {
						data.error = -Number.MIN_VALUE;
						data.msg = err.message;
					} else {
						data.error = httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 ? 0 : httpResponse.statusCode;
						try {
							var proxyData = JSON.parse(body);
							data.data = proxyData;
						} catch (e) {
							// illegal formatting?
						}
						data.statusCode = httpResponse.statusCode;
						resp.json(data);
					}
				});
				break;
			default:
				resp.json({
					error: Number.MIN_VALUE,
					msg: 'no method supplied matched',
				});
				break;
		}
	},
	_doApi: function (allowNullMapping, tpl) {
		var _this = this;
		// translate to string http type
		var selfMethod = this._method;
		var selfHttpType = selfMethod == ProxyConfigBase.METHOD_GET ? 'get' : 'post';
		var selfUrl = this.toUrlString();

		// handle as routering
		var trs = this._targetRequests;
		if (trs.length == 0 && allowNullMapping === false) {
			throw new Error('you do not have any mapping api in \''+selfUrl+'\', have you forgot something?');
		}
		router[selfHttpType](selfUrl, function (req, resp, next) {
			// let's do it from first mapping
			var mapping = trs[0];
			_this._doSingleApi(req, resp, next, selfMethod, mapping);
		});
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

		this._doApi();
		return this;
	},
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
