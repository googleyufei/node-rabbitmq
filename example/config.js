exports.service={
	isProxy:false //是否启用代理
	,isAnew:true //进程死亡时是否新建
	,anewTime:5000 //新建的间隔
	,workerTatol:2 //进程总数，如为空默认取cpu总数
};
//socket
exports.socket={
	port:8040,
	logLevel:3
};

//redis
exports.redis={
	host:'127.0.0.1',
	port:6379,
	socketDB:7,
	debug_mode:false
};

exports.rabbit={
	addresses:"127.0.0.1:5672,127.0.0.2:5672",
	username:"guest",
	password:"guest",
	messageDefaultCharset:"UTF-8",
	receiveQueueName:"a_w_msg_queue"
};

