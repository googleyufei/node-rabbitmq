var amqp = require('amqp');

var config=require('./config.js'),
log=require('./logger.js').getLogger("system");

var addresses=[];

if(config.rabbit.addresses){
	var addreGroups=config.rabbit.addresses.split(",");
	for(var i=0;i<addreGroups.length;i++){
		var addres=addreGroups[i].split(":");
		if(addres.length ==2){
			addresses.push({host:addres[0],port:addres[1]});
		}
	}
}

exports.getConnection=function (){
	if(addresses.length ==0){
		throw "not find rabbit host info";
	}
	
	var connection =amqp.createConnection(getConnOption(),{reconnect: false,defaultExchangeName: 'amq.topic'});
	connection.on('error', function (error) {
		//如果有异常尝试连接其它机器
	    log.error('Rabbit Connection error' + error+';host:'+connection.options.host);
	    connection.setOptions(getConnOption(connection.options.host));
	    connection.reconnect();
	    log.info('Rabbit Attempts to reconnect');
	});
	connection.on('close', function () {
		log.info('Rabbit Connection close');
	});
	connection.on('connect', function () {
		log.info('Rabbit Connection connect Success');
	});
	if(connection){
		return connection;
	}
}
function getConnOption(excludeHost){
	if(addresses.length ==0){
		throw "not find rabbit host info";
	}
	for(var i=0;i<addresses.length;i++){
		var addre=addresses[i];
		if(excludeHost){
			if(addre.host == excludeHost){
				continue;
			}
		}
		addre.login=config.rabbit.username;
		addre.password=config.rabbit.password;
		
		return addre;
	}
}