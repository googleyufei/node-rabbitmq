var express=require('express')
,app = express()
, sio=require('socket.io')
, http = require('http').createServer(app)
, io = sio.listen(http)
,amqp = require('amqp')
,fs  = require('fs')
,RedisStore = sio.RedisStore;

require('date-utils');

var config=require('./../config.js'),
rabbitConnectionFactory=require('./../rabbitConnectionFactory.js'),
redisConnectionFactory=require('./../redisConnectionFactory.js'),
log=require('./../logger.js').getLogger("system"),
SocketManage=require('./../socketMemoryManage.js').SocketManage,
socketManage=new SocketManage(),
cookieUtil=require('./../cookieUtil.js');

var port = process.argv[2] || config.socket.port
, appId = process.argv[3] || 0;
global.appId=appId;

var redisPub = redisConnectionFactory.getConnectionToDB(config.redis.socketDB);
var redisSub = redisConnectionFactory.getConnectionToDB(config.redis.socketDB);
var redisClient = redisConnectionFactory.getConnectionToDB(config.redis.socketDB);

//当redisSub出现error时
redisSub.on("error",function (){
	log.error("socket.io redisSub error,exit");
	process.exit(1);
});

io.configure(function () {
	//使用redis存储会话
	 io.set('store', new RedisStore({
				 redisPub:redisPub,
				 redisSub:redisSub,
				 redisClient:redisClient
			}
	));
});
	
//定义web共享环境
app.configure(function(){
    //设置静态文件目录
    app.use(express.static(__dirname+'/client'));
});

//创建webscoket监听服务器
http.listen(port);

//set log level
io.set("log level", config.socket.logLevel);

var msgSubClient = redisConnectionFactory.getConnectionToDB(config.redis.socketDB);
var msgGroupSubClient = redisConnectionFactory.getConnectionToDB(config.redis.socketDB);

var msgKey="amsg:",groupMsgKey="amsg_group:";

io.sockets.on('connection',function(socket){ 
	log.debug(socket.id+":connection "+appId);
	//注册
	socket.on('register',function (data){
		log.debug(socket.id+" register "+appId+",sessionId:"+data.sessionId+" groupFlag:"+data.groupFlag);
		if(data.sessionId){
			socketManage.addIdMap(data.sessionId,socket.id);
		}
		if(data.groupFlag){
			if(!socket.groupFlag){
				socket.groupFlag=[];
			}
			socket.groupFlag.push(data.groupFlag);
			socketManage.addGroupItem(data.groupFlag,socket.id);
		}
		//订阅消息
		msgSubClient.subscribe(msgKey+socket.id);
	});
	//关闭时清除连接的注册信息
	socket.on('disconnect',function(){
		log.debug(socket.id+":disconnect "+appId);
		if(socket.groupFlag){
			for(var i=0;i<socket.groupFlag.length;i++){
				socketManage.removeGroupItem(socket.groupFlag[i],socket.id);
			}
		}
		socketManage.removeIdMap(socket.id);
		//取消消息订阅
		msgSubClient.unsubscribe(msgKey+socket.id); 
	});
});

//socket group 新建
socketManage.on("group_new",function (groupFlag){
	log.debug(groupFlag+" group_new subscribe message");
	msgGroupSubClient.subscribe(groupMsgKey+groupFlag);
});

//socket group 已空
socketManage.on("group_null",function (groupFlag){
	log.debug(groupFlag+" group_null unsubscribe message");
	msgGroupSubClient.unsubscribe(groupMsgKey+groupFlag);
});

//redis 消息
msgSubClient.on("message", function (channel, message) {
	var oldId=channel.substring(msgKey.length,channel.length);
	var socket=io.sockets.sockets[oldId];
	if(socket){
		emitMessageToClietn(socket,JSON.parse(message));
		//log.debug(appId+" emit "+oldId+" msg:"+message);
	}
});

//redis 消息
msgGroupSubClient.on("message", function (channel, message) {
	var json=JSON.parse(message);
	if(appId != json.nodeId){
		var groupFlag=channel.substring(groupMsgKey.length,channel.length);
		emitMessageGroupToClietn(groupFlag,json.msg);
		//log.debug("msgGroupSubClient message group:"+groupFlag);
	}
});


var msgPubClient = redisConnectionFactory.getConnectionToDB(config.redis.socketDB);
//推送到客户端消息
function emitMessageToClietn(socket,msg){
	if(msg.data){
		if(typeof msg.data == "string"){
			msg.data=JSON.parse(msg.data);
		}
	}
	if(socket){
		socket.emit('message', msg);
	}
}

//推送消息给组的客户端
function emitMessageGroupToClietn(groupFlag,msg){
	var items=socketManage.getGroupItme(groupFlag);
	if(items){
		var count=0;
		var begin=new Date().getTime();
		for(var i=0;i<items.length;i++){
			var socket=io.sockets.sockets[items[i]];
			if(socket){
				emitMessageToClietn(socket,msg);
				count++;
			}
		}
		var end=new Date().getTime();
		//log.info("emitMessageGroupToClietn "+count+" items length "+items.length+" time "+(end-begin));
	}
}

//推送消息
function emitMessage(oldId,msg){
	var socket=io.sockets.sockets[oldId];
	if(socket){
		//推送到客户端消息
		emitMessageToClietn(socket,msg);
	}else{
		//推送到队列
		msgPubClient.publish(msgKey+oldId,JSON.stringify(msg));
	}
}

//推送消息给组
function emitMessageGroup(groupFlag,msg){
	//消息给其它服务
	msgPubClient.publish(groupMsgKey+groupFlag,JSON.stringify({nodeId:appId,msg:msg}));
	
	//推送给本服务上的客户
	emitMessageGroupToClietn(groupFlag,msg);
}

var rabbitConnection=rabbitConnectionFactory.getConnection();

rabbitConnection.on('ready', function () {
	var q=rabbitConnection.queue(config.rabbit.receiveQueueName,
			{durable:true,autoDelete:false,'arguments': {'x-message-ttl': 600000}});
	 // Receive messages
    q.subscribe({ ack: true, prefetchCount: 1 },function (json, headers, deliveryInfo, m) {
	  	try{
	      	var socketSessionId=json.socketSessionId;
	      	var groupFlag=json.socketGroupFlag;
	      	//如有group 就按组推送
	      	if(groupFlag && groupFlag !=""){
	      		emitMessageGroup(groupFlag,json);
	      	}
	        //如有socketSessionId 就按单客户推送
	      	if(socketSessionId && socketSessionId!=""){
	      		var oldId=socketManage.getOldId(socketSessionId);
	      		if(oldId){
	      			emitMessage(oldId,json);
	      		}
	      	}
	      	//m.acknowledge();
	      	//q.basicAck(deliveryInfo.deliveryTag,true);
	      	log.debug("rabbit to node message");
	  	}catch(e){
	  		log.error(e);
	  	}
	  	try{
	      	m.acknowledge(true);
	  	}catch(e){
	  		log.error("ack msg error:",e);
	  	}
    });
});