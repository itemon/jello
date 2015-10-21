# Jello 服务端api映射框架

## 要解决的问题 

前后端分离的开发方案中，前端的数据层被剥离出来而独立存在，通常数据层由服务端的api来提供，这就导致我们需要在Express的路由层
反复的配置；一方面会导致重复劳动,写作繁杂，另一方面对不熟悉nodejs的前端开发同学是一个比较大负担。

## 用法

```bash
	// 导入Jello对象, 需要传入express的app实例，路由层router的实例
	var Jello = require('./jello')(app, router);
		
	// 初始化一个服务器接口的通用配置，比如域名和协议等。
	var proxy = Jello.host('www.baidu.com').protocol('https');

	// 由通用配置实例化一个具体的服务器接口，并指定路径 
	var proxyIndexApi = proxy.api('/home/msg/data/personalcontent');
	// 实例化一个本地路由配置并映射到服务器的接口实例上
	Jello.pathname('/index').api().map(proxyIndexApi);

```
