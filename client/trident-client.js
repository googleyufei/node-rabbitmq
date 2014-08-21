var TridentClient=new function (){
	var callbackFuns=[];
	var dataKey="data";
	var callbackFunKey="callbackFun";
	var messageKey="message";
	var registerKey="register";
	var optionsDefault={
		sessionId:"",
		groupFlag:"",
		callbackFun:{}
	}
	
	this.connect=function(http,options){
		if(options){
			var temp=options;
			options=optionsDefault;
			options=jQuery.extend(options,temp);
		}else{
			options=optionsDefault;
		}
		if(options.callbackFun){
			this.addCallbackFun(options.callbackFun);
		}
		var socket = io.connect(http);
		socket.on('connect',function (){
			socket.emit(registerKey,{socketId:options.socketId,groupFlag:options.groupFlag});
		});
		socket.on(messageKey,function (data) {
			var callbackFunName=data[callbackFunKey];
			if(callbackFunName && callbackFuns[callbackFunName]){
				callbackFuns[callbackFunName](data[dataKey]);
			}
		});
	}
	//增加回调方法
	//单个增加：addCallbackFun("getUserInf_call",funciton (){});
	//多个增加：addCallbackFun({getUserInf_call:function(){}});
	this.addCallbackFun=function (callbackFun){
		if(arguments.length == 2){
			if(typeof arguments[0] == "string" && typeof arguments[1] == "function"){
				callbackFuns[arguments[0]]=arguments[1];
			}
		}else{
			if(typeof callbackFun == "object"){
				for(var key in callbackFun){
					if(typeof callbackFun[key] == "function"){
						callbackFuns[key]=callbackFun[key];
					}
				}
			}
		}
	}
	//重置连接
	this.reconnect=function (http,options){
		var temp=options;
		options=optionsDefault;
		options=jQuery.extend(options,temp);
		io.sockets[http].on('connect',function (){
			io.sockets[http].emit(registerKey,{sessionId:options.sessionId,groupFlag:options.groupFlag});
		});
		io.sockets[http].disconnect();
		io.sockets[http].reconnect();
	}
}();

