
exports.parseCookie=function (cookie){
	var array=cookie.split("; ");
	var cookies=[];
	for(var i=0;i<array.length;i++){
		var item=array[i].split("=");
		if(item.length ==2){
			cookies[item[0]]=item[1];
		}
	}
	return cookies;
}