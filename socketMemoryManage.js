var redisConnectionFactory=require('./redisConnectionFactory.js')
,log=require('./logger.js').getLogger("socketManage")
, EventEmitter = require('events').EventEmitter
, util = require('util')
,config=require('./config.js');

exports.SocketManage=SocketManage;

function SocketManage(){
	//socket 的分组key
	this.group={};
	
	//socket id 映射,格式为 {自定义 ID:原ID}
	this.idMap={};
	//
	this.idMapInverse={};
}

util.inherits(SocketManage, EventEmitter);

/**
* 删除 group item
*/
SocketManage.prototype.removeGroupItem=function(groupFlag,item) {
	var items=this.group[groupFlag];
	if(items){
		items.splice(items.indexOf(item), 1);
	}
	if(items.length == 0){
		delete this.group[groupFlag];
		this.emit("group_null",groupFlag);
	}
}
/**
*  得到Group
*/
SocketManage.prototype.getGroupItme=function(groupFlag,call) {
	var items=this.group[groupFlag];
	return items || {};
}

/**
* 添加 group
*/
SocketManage.prototype.addGroupItem=function(groupFlag,item) {
	var items=this.group[groupFlag];
	if(!items){
		items=[];
		this.group[groupFlag]=items;
		this.emit("group_new",groupFlag);
	}
	items.push(item);
}

/**
* 删除 idMap
*/
SocketManage.prototype.removeIdMap=function(oldId) {
	var socketSessionId=this.idMapInverse[oldId];
	if(socketSessionId){
		delete this.idMapInverse[oldId];
		delete this.idMap[socketSessionId];
	}
}
/**
*  得到原ID
*/
SocketManage.prototype.getOldId=function(socketSessionId) {
	return this.idMap[socketSessionId];
}

/**
* 添加idMap
*/
SocketManage.prototype.addIdMap=function(socketSessionId,oldId) {
	this.idMap[socketSessionId]=oldId;
	this.idMapInverse[oldId]=socketSessionId;
}