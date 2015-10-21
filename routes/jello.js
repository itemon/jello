'use strict';

var urler = require('url');
var express = require('express');
var request = require('request');

//TODO injecting global variable, imporving this later
var app, router;

var VERSION = '1.0.0beta';
var NAME = "JELLO";

var JELLO_DEBUG_VIEW_DATA = "data";

/****
 * base class
 */
var JelloBase = function () {
	this._httpConf = {};
	this._method = JelloBase.METHOD_GET;
	this._usingJsonFormat = true;
};

JelloBase.METHOD_GET = 0;
JelloBase.METHOD_POST = 1;
JelloBase.METHOD_PUT = 2;

JelloBase.PATTERN_PATH = /^[\w_\/%]+$/gi;
JelloBase.prototype = {
	host: function (host) {
		if (typeof host !== 'undefined') {
			this._httpConf.host = host;
		}
		return this;
	},
	query: function (query) {
		var toString = Object.prototype.toString;
		if (toString.call(query) == '[object Object]') {
			this._httpConf.query = query;
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
		this._method = JelloBase.METHOD_GET;
		return this;
	},
	post: function () {
		this._method = JelloBase.METHOD_POST;
		return this;
	},
	put: function () {
		this._method = JelloBase.METHOD_PUT;
		return this;
	},
	pathname: function (pathname) {
		if (typeof pathname !== 'undefined') {
			var pattern = JelloBase.PATTERN_PATH;
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
 * Jello is an http url config object representing all http component
 * it can factorying an http request instance
 */
var Jello = function () {
	JelloBase.call(this);
}
Jello._handleCall = function (/**host, arg1, arg2**/) {
	var args = Array.prototype.slice.call(arguments, 0);
	if (args.length < 2) {
		throw new Error('have you forgot to pass in host argument?');
	}
	var host = args[0];
	var method = args[1];
	var otherArgs = args.slice(2);

	var proto = JelloBase.prototype[method];
	//if (typeof proto == 'undefined')
	//	proto = Jello.prototype[method];

	if (host instanceof Jello) {
		proto.apply(host, otherArgs);
		return this;
	} else {
		var instance = new Jello();
		proto.apply(instance, otherArgs);
		return instance;
	}
}
Jello.host = function (host) {
	return Jello._handleCall(this, 'host', host);
}
Jello.protocol = function (protocol) {
	return Jello._handleCall(this, 'protocol', protocol);
}
Jello.pathname = function (pathname) {
	return Jello._handleCall(this, 'pathname', pathname);
}
Jello.query = function (query) {
	return Jello._handleCall(this, 'query', query);
}
Jello.get = function () {
	return Jello._handleCall(this, 'get');
}
Jello.post = function () {
	return Jello._handleCall(this, 'post');
}
Jello.put = function () {
	return Jello._handleCall(this, 'put');
}
Jello.json = function (json) {
	return Jello._handleCall(this, 'json', json);
}

/****
 * fast creation method
 */
Jello._handleCallEx = function (/*arg1, arg2, arg3*/) {
	var args = Array.prototype.slice.call(arguments, 0);
	if (args.length < 2) {
		throw new Error('have you forgot to pass in host argument?');
	}
	var host = args[0];
	var method = args[1];
	var otherArgs = args.slice(2);

	var proto = Jello.prototype[method];
	return proto.apply(host, otherArgs);
}
Jello.api = function (path) {
	return Jello._handleCallEx(this, 'api', path);
}
Jello.page = function (path) {
	return Jello._handleCallEx(this, 'page', path);
}

Jello.prototype = {
	__proto__: JelloBase.prototype,
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
	JelloBase.call(this);
	if (proxyConfig instanceof JelloBase) {
		// copy main config
		this.fromConfig(proxyConfig.getConf());
		// copy method and other conf
		this._method = proxyConfig._method;
		this._usingJsonFormat = proxyConfig._usingJsonFormat;
	}
	this._targetRequests = null;
	this._app = null;
	this._acceptCookie = false;
}
HttpRequest.prototype = {
	__proto__: JelloBase.prototype,
	fromConfig: function (conf) {
		/*
		for (var i in conf) {
			if (conf.hasOwnProperty(i)) {
				this._httpConf[i] = conf[i];
			}
		}
		*/
		this._httpConf = this._fastCopy(conf);
	},
	cookie: function (accept) {
		this._acceptCookie = accept;
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
	_fastCopy: function (obj) {
		//var clone = Object.create(null);
		var clone = {};
		var toString = Object.prototype.toString;
		for (var p in obj) {
			if (obj.hasOwnProperty(p)) {
				var fromValue = obj[p];
				// deep copy
				if (toString.call(fromValue) == '[object Object]') {
					clone[p] = this._fastCopy(fromValue);
				} else {
					clone[p] = fromValue;
				}
			}
		}
		return clone;
	},
	/**
	 * @req http original request object
	 * @mapping the single mapping of this request
	 * it works like this, the mapping url of this request 
	 * could be determinte daynamically based on the provided query arguments
	 * if the mapping url you provided is like '/hello/%world', the path of the api or page is '/local/'
	 * when you request the original page or api instance, you need to provide a query
	 * with name 'world', as /local/?world=123
	 */
	_handleQuerySupersede: function (req, mapping) {
		var pathname = mapping._httpConf.pathname;
		if (pathname.indexOf('%') != -1) {
			var copyOfConf = this._fastCopy(mapping._httpConf);
			pathname = copyOfConf.pathname;
			var querys = req.query;
			for (var q in querys) {
				if (querys.hasOwnProperty(q)) {
					var itemValue = querys[q];
					var regexp = new RegExp('%'+q);
					pathname = pathname.replace(regexp, itemValue);
				}
			}
			// update pathname
			copyOfConf.pathname = pathname;
			//console.log('in supersede mode, final url is %s', urler.format(copyOfConf));
			return urler.format(copyOfConf);
		} else {
			return mapping.toUrlString();
		}
	},
	_doSingleApi: function (req, resp, next, selfMethod, mapping, tpl) {
		var method = mapping.getMethod();
		//var url = mapping.toUrlString();
		var url = this._handleQuerySupersede(req, mapping);
		var _this = this;

		switch (method) {
			case JelloBase.METHOD_GET:
			case JelloBase.METHOD_POST:
				var _start = new Date().getTime();
				console.log('request %s', url);
				var carryData = {
					url: url,
					headers: {
						cookie: req.headers.cookie,//including cookie
					}
				}
				// bring post data provide in post request and mapping request in post mode
				if (method == JelloBase.METHOD_POST && selfMethod == JelloBase.METHOD_POST) {
					carryData.data = req.body;
				}
				var httpType = method == JelloBase.METHOD_GET ? 'get' : 'post';
				request[httpType](carryData, function(err, httpResponse, body) {
					var data = _this._wrap(_start, new Date().getTime());
					if (err) {
						data.error = -Number.MIN_VALUE;
						data.msg = err.message;
					} else {
						data.error = httpResponse.statusCode >= 200 && httpResponse.statusCode < 300 
											? 0 : httpResponse.statusCode;
						try {
							var proxyData = JSON.parse(body);
							data.data = proxyData;
						} catch (e) {
							// illegal formatting?
						}
						data.statusCode = httpResponse.statusCode;
						// write cookie back
						// do accept cookie only allowed
						if (mapping._acceptCookie === true) {
							var cookie = httpResponse.headers['set-cookie'];
							if (typeof cookie != 'undefined') {
								resp.setHeader('Set-Cookie', cookie);
							}
						}
						// consider as tpl rendering providing has tpl setting
						if (typeof tpl === 'string') {
							resp.render(tpl, data);
						} else {
							resp.json(data);
						}
					}
				});
				break;
			default:
				var data = this._wrap(0, 0);
				data.error = Number.MIN_VALUE;
				data.msg = 'no method supplied matched';
				resp.json(data);
				break;
		}
	},
	_doApi: function (allowNullMapping, tpl) {
		var _this = this;
		// translate to string http type
		var selfMethod = this._method;
		var selfHttpType = selfMethod == JelloBase.METHOD_GET ? 'get' : 'post';
		var selfUrl = this.toUrlString();

		// handle as routering
		var trs = this._targetRequests;
		if (trs.length == 0 && allowNullMapping === false) {
			throw new Error('you do not have any mapping api in \''+selfUrl+'\', have you forgot something?');
		}
		var fastExit = trs.length == 0 && allowNullMapping !== false && typeof tpl === 'string';

		router[selfHttpType](selfUrl, function (req, resp, next) {
			// 
			// fast rendering for empty mapping for page request
			//
			if (fastExit) {
				var data = _this._wrap(0, 0);
				if (req.query.jello === JELLO_DEBUG_VIEW_DATA) {
					resp.json(data);
				} else {
					resp.render(tpl, data);
				}
				return;
			}
			//
			// let's do it from first mapping
			//
			var mapping = trs[0];
			if (req.query.jello === JELLO_DEBUG_VIEW_DATA) {
				_this._doSingleApi(req, resp, next, selfMethod, mapping);
			} else {
				_this._doSingleApi(req, resp, next, selfMethod, mapping, tpl);
			}
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
PageHttpRequest.PATTERN_CHAR = /[\\\/-]/gi;
PageHttpRequest.PATTERN_TRIM = /(^[\\\/]+|[\\\/]+$)/gi;
PageHttpRequest.prototype = {
	__proto__: HttpRequest.prototype,
	render: function (file) {
		this._renderFile = file;
		return this;
	},
	_usingDefaultTpl: function () {
		var pathname = this._httpConf.pathname;
		// trim slash both end
		pathname = pathname.replace(PageHttpRequest.PATTERN_TRIM, "");
		// translate unfriendly char
		return pathname.replace(PageHttpRequest.PATTERN_CHAR, '_');
	},
	map: function (/*arg1, arg2, arg3, arg4*/httpRequest) {
		this._checkLocal();

		var args = Array.prototype.slice.call(arguments, 0);
		var reqs = this._checkMapRequest(args);
		this._targetRequests = reqs;

		var tpl = this._renderFile;
		if (typeof tpl !== 'string') {
			tpl = this._usingDefaultTpl();
		}

		this._doApi(true, tpl);
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

		this._doApi(false);
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
	return Jello;
}

exports = module.exports = injecter;
