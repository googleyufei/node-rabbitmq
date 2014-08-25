var redisConnectionFactory=require('./redisConnectionFactory.js')
,log=require('./logger.js').getLogger("socketManage")
,config=require('./../config.js');

var redisClient = redisConnectionFactory.getConnectionToDB(config.redis.socketDB);

//socket 的分组key
var groupKey="node_socket_group";

//socket id 映射,格式为 {自定义 ID:原ID}
var idMapKey="node_socket_idmap";
//
var idMapInverseKey="node_socket_idmap_inverse";

/**
* 删除 group item
*/
exports.removeGroupItem=function(groupFlag,item) {
	var key=groupKey+"_"+groupFlag;
	redisClient.srem(key,item,function (err, reply){
        if(!err){
        	log.debug("delete the group '"+groupFlag+"','"+item+"'");
        }
	});
}
/**
*  得到Group
*/
exports.getGroupItme=function(groupFlag,call) {
	var key=groupKey+"_"+groupFlag;
	var result=redisClient.smembers(key,function (err, data){
        if(err){
        	log.error(err);
        }else{
        	if(call){
        		call(data);
        	}
        }
	});
	return result;
}

/**
* 添加 group
*/
exports.addGroupItem=function(groupFlag,item) {
	var key=groupKey+"_"+groupFlag;
	redisClient.sadd(key,item,function (err, reply){
        if(!err){
        	log.debug("add '"+item+"' to group '"+key+"'");
        }
	});
}

/**
* 删除 idMap
*/
exports.removeIdMap=function(oldId) {
	var multi = redisClient.multi();
	var socketSessionId=redisClient.hget(idMapInverseKey,oldId);
	if(socketSessionId){
		multi.hdel(idMapKey,socketSessionId);
		multi.hdel(idMapInverseKey,oldId);
		multi.exec(function (err, replies) {
	        if(!err){
	        	log.debug("delete id map '"+oldId+"'");
	        }
	    });
	}
}
/**
*  得到原ID
*/
exports.getOldId=function(socketSessionId) {
	return redisClient.hget(idMapKey,socketSessionId);
}

/**
* 添加idMap
*/
exports.addIdMap=function(socketSessionId,oldId) {
	var multi = redisClient.multi();
	multi.hset(idMapKey,socketSessionId);
	multi.hset(idMapInverseKey,oldId);
	multi.exec(function (err, replies) {
        if(!err){
        	log.debug("add id map '"+socketSessionId+"' to '"+oldId+"'");
        }
    });
}