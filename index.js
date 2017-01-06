var socket = io.connect();

function getAccount() {
	socket.emit('getAccountRequest',"");
}

function getHierarchy() {
	socket.emit('getHierarchyRequest',"");
}

function getReportByChannel() {
	var cid = $('#nodeID').val();
	socket.emit('getReportByChannelRequest',cid);
}

function getReportByNode() {
	var nid = $('#nodeID').val();
	socket.emit('getReportByNodeRequest',nid);
}

function showNodeForm(id) {
	var id = $('#nodeID').val();
	if(id == 1)
		$('#report').on("click",function() {
			socket.emit('getReportByChannelRequest',id);			
		});
	else
		$('#report').on("click",function() {
			socket.emit('getReportByNodeRequest',id);			
		});
	$('#nodeid').show(500);
	$("#signinform").hide();
}

$(document).ready(function() {
	
	$('#nodeid').hide();
	$("#signinform").hide();
	
	$('#signinform').submit(function(event) {
		event.preventDefault();
		var name = $('#username').val();
		var pwd = $('#password').val();
		signin(name,pwd);
	});
	
	socket.on('errorResponse', function(data){
		$("#error").text(data);
	});
	socket.on('goodResponse', function(data){
		$("#message1").html(data);
	});
	socket.on('signinResponse', function(data) {
//		saveCookie("username", data.name, 1);	// save as cookie for 1 day
//		saveCookie("password", data.pwd, 1);
		$('#error').text("");
		$('#myname').text(data.name);
		$("#signinform").hide();
		console.log("Successfully signed in");
	});	
	// this returns an array of Cuser objects
	socket.on('getHierarchyResponse',function(data){
		var str="<table><tr><td>NodeID</td><td>Name</td><td>Group</td></tr>";
		console.log("Array size: "+data.length);
		for(var i in data)
		{
			str += "<tr><td>"+data[i].nodeID+"</td>";
			str += "<td>"+data[i].name+"</td>";
			str += "<td>"+data[i].type+"</td></tr>";
		}
		str += 	"</table>";	
		$("#message1").html(str);
	});
	
	socket.on('report1Response', function(data){		// this returns an array of objects
	var report = "<table>";
		for(var i in data)
		{
			report += "<tr>";
			report += "<td>"+data[i].sessionID+"</td>";
			report += "<td>"+data[i].name+"</td>";
			report += "</tr>";
		}
		report += "</table>";
		$("#message2").html(report);
	});

});

function loginForm() {
str = '<div class="form-horizontal col-xs-9 col-xs-offset-3">' +
	'<form id="signinform">'+
		'<div class="form-group">'+
			'<label class="control-label col-xs-2">Username:</label>'+
			'<div class="col-xs-3">'+
				'<input class="form-control" id="username" type="text"></input>'+
			'</div>'+
		'</div>'+
		'<div class="form-group">'+
			'<label class="control-label col-xs-2">Password:</label>'+
			'<div class="col-xs-3">'+
				'<input class="form-control" id="password" type="password"></input>'+
			'</div>'+
			'<div class="col-xs-3">'+
				'<input class="btn btn-primary" type="submit" value="Sign In"></input>'+
			'</div>'+
		'</div>'+
	'</form>'+
'</div>';

document.write(str);
}

function showLoginForm()
{
	$("#signinform").show(500);
	$('#nodeid').hide();
}

function signin(uname, pwd) {
	var data = new Object();
	data = {name: uname,pwd: pwd};
//	console.log("Data object: "+data.name+" and "+data.pwd);
	socket.emit('signinRequest', data);
}
