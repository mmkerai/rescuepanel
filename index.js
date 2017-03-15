var socket = io.connect();

function getAccount() {
	socket.emit('accountRequest',"");
}

function getHierarchy() {
	socket.emit('hierarchyRequest',"");
}

function getReport(id) {
	var nid = $('#nodeID').val();
	var bdate = $('#bdate').val();
	var edate = $('#edate').val();
	$("#message1").html("");
	$("#error").html("");
	var params = {"id":nid,"bdate":bdate,"edate":edate};
	if(id == 0)
	{
		params["idtype"] = "CHANNEL";
		socket.emit('Report12Request',params);
	}
	else if(id == 1)
	{
		params["idtype"] = "NODE";
		socket.emit('Report12Request',params);
	}
	else if(id == 2)
	{
		params["idtype"] = "CHANNEL";
		socket.emit('Report3Request',params);
	}
	else if(id == 3)
	{
		params["idtype"] = "NODE";
		socket.emit('Report3Request',params);
	}
	else if(id == 4)
	{
		params["idtype"] = "CHANNEL";
		socket.emit('CSReportRequest',params);
	}
	else if(id == 5)
	{
		params["idtype"] = "NODE";
		socket.emit('CSReportRequest',params);
	}
}

function showNodeForm(id) {

	$('#report').on("click",function() {
		getReport(id);		
	});	
	$('#nodeid').show(500);
	$("#signinform").hide();
}

$(document).ready(function() {
	
	$('#nodeid').hide();
	$("#signinform").hide();
	
	checkSignedIn();
	
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
		saveCookie("username", data.username, 1);	// save as cookie for 1 day
		saveCookie("password", data.password, 1);
		$('#error').text("");
		$('#myname').text(data.username);
		$("#signinform").hide();
		console.log("Successfully signed in");
	});	
	// this returns an array of Cuser objects
	socket.on('hierarchyResponse',function(data){
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
	
	socket.on('Report12Response', function(data){		// this returns an array of objects
		$("#message1").text("");
		var report = "<table border='1'><tr><td>Session</td><td>Type</td><td>Name</td><td>Department</td><td>Start</td><td>End</td><td>RC</td>"+
					"<td>Resolved</td><td>Wait Time</td><td>Total Time</td><td>Active Time</td><td>Work Time</td><td>Wrap Time</td>"+
					"<td>Score</td><td>Comment</td>";
		for(var i in data)
		{
			report += "<tr>";
			report += "<td>"+data[i].sessionID+"</td>";
			report += "<td>"+data[i].sessionType+"</td>";
			report += "<td>"+data[i].name+"</td>";
			report += "<td>"+data[i].department+"</td>";
			report += "<td>"+data[i].start+"</td>";
			report += "<td>"+data[i].end+"</td>";
			report += "<td>"+data[i].RC+"</td>";
			report += "<td>"+data[i].resolved+"</td>";
			report += "<td>"+data[i].waitTime+"</td>";
			report += "<td>"+data[i].totalTime+"</td>";
			report += "<td>"+data[i].activeTime+"</td>";
			report += "<td>"+data[i].workTime+"</td>";
			report += "<td>"+data[i].wrapTime+"</td>";
			report += "<td>"+data[i].surveyScore+"</td>";
			report += "<td>"+data[i].surveyComment+"</td>";
			report += "</tr>";
		}
		report += "</table>";
		$("#message1").html(report);
	});

	socket.on('CSReportResponse', function(data){		// this returns an array of objects
		$("#message1").text("");
		var report = "<table border='1'><tr><td>Session</td><td>Source</td><td>Date</td><td>User Name</td><td>Rating</td><td>Technician Name</td><td>Technician ID</td>";
		for(var i in data)
		{
			report += "<tr>";
			report += "<td>"+data[i].sessionID+"</td>";
			report += "<td>"+data[i].source+"</td>";
			report += "<td>"+data[i].date+"</td>";
			report += "<td>"+data[i].username+"</td>";
			report += "<td>"+data[i].rating+"</td>";
			report += "<td>"+data[i].techName+"</td>";
			report += "<td>"+data[i].techID+"</td>";
			report += "</tr>";
		}
		report += "</table>";
		$("#message1").html(report);
	});
	
	socket.on('TSReportResponse', function(data){		// this returns an array of objects
		$("#message1").text("");
		var report = "<table border='1'><tr><td>Session</td><td>Source</td><td>Date</td><td>User Name</td><td>Evaluation</td><td>Technician Name</td><td>Technician ID</td>";
		for(var i in data)
		{
			report += "<tr>";
			report += "<td>"+data[i].sessionID+"</td>";
			report += "<td>"+data[i].source+"</td>";
			report += "<td>"+data[i].date+"</td>";
			report += "<td>"+data[i].username+"</td>";
			report += "<td>"+data[i].evaluate+"</td>";
			report += "<td>"+data[i].techName+"</td>";
			report += "<td>"+data[i].techID+"</td>";
			report += "</tr>";
		}
		report += "</table>";
		$("#message1").html(report);
	});
	
	socket.on('Report3Response', function(data){		// this returns an array of objects
		$("#message1").text("");
		var report = "<table border='1'><tr><td>Tech Name</td><td>Tech ID</td><td>Sessions</td><td>Total Login Time</td>" +
					"<td>Average Pickup Time</td><td>Average Duration</td><td>Average Work Time</td>"+
					"<td>Total Active Time</td><td>Total Work Time</td>";
		for(var i in data)
		{
			report += "<tr>";
			report += "<td>"+data[i].techName+"</td>";
			report += "<td>"+data[i].techID+"</td>";
			report += "<td>"+data[i].noOfSessions+"</td>";
			report += "<td>"+data[i].totalTime+"</td>";
			report += "<td>"+data[i].avgPickup+"</td>";
			report += "<td>"+data[i].avgDuration+"</td>";
			report += "<td>"+data[i].avgWorkTime+"</td>";
			report += "<td>"+data[i].totalActiveTime+"</td>";
			report += "<td>"+data[i].totalWorkTime+"</td>";
			report += "</tr>";
		}
		report += "</table>";
		$("#message1").html(report);
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

function checkSignedIn()
{
	var name = readCookie("username");
	var pwd = readCookie("password");
//	console.log("User cookie: "+name+" and pwd "+pwd);
	if(name == null || pwd == null)
	{
		$('#myname').text("Log Me In");
		$("#signinform").show();
	}
	else
	{
		signin(name,pwd);
	}
}

function signin(uname, pwd) {
	var data = new Object();
	data = {"username": uname,"password": pwd};
//	console.log("Data object: "+data.name+" and "+data.pwd);
	socket.emit('signinRequest', data);
}

function readCookie(name)
{
  name += '=';
  var parts = document.cookie.split(/;\s*/);
  for (var i = 0; i < parts.length; i++)
  {
    var part = parts[i];
    if (part.indexOf(name) == 0)
      return part.substring(name.length);
  }
  return null;
}

/*
 * Saves a cookie for delay time. If delay is blank then no expiry.
 * If delay is less than 100 then assumes it is days
 * otherwise assume it is in seconds
 */
function saveCookie(name, value, delay)
{
  var date, expires;
  if(delay)
  {
	  if(delay < 100)	// in days
		  delay = delay*24*60*60*1000;	// convert days to milliseconds
	  else
		  delay = delay*1000;	// seconds to milliseconds

	  date = new Date();
	  date.setTime(date.getTime()+delay);	// delay must be in seconds
	  expires = "; expires=" + date.toGMTString();		// convert unix date to string
  }
  else
	  expires = "";

  document.cookie = name+"="+value+expires+"; path=/";
}

/* build csvfile from table to export snapshot
 */
function tableToCsvFile(dashtable) {
	var key, keys, j, i, k;
	var str = "";

	$('#download').hide();
	$("#message1").text("Preparing file for export");
	var exportData = "Dashboard Metrics Export "+new Date().toUTCString()+"\r\n";
	exportData = exportData + "\r\n";
	var ttable = document.getElementById(dashtable);
	for(var x = 0; x < ttable.rows.length; x++)
	{
		row = ttable.rows[x];
		for (var j = 0, col; col = row.cells[j]; j++)
		{
			str = str +"\""+ col.innerHTML + "\",";
		}
		str = str + "\r\n";
	}
	exportData = exportData + str +"\r\n";
	prepareDownloadFile(exportData);
}

/*
 *	This function makes data (typically csv format) available for download
 *  using the DOM id "download" which should be labelled "download file"
 */
function prepareDownloadFile(data)
{
	var filedata = new Blob([data], {type: 'text/plain'});
	// If we are replacing a previously generated file we need to
	// manually revoke the object URL to avoid memory leaks.
	if (csvfile !== null)
	{
		window.URL.revokeObjectURL(csvfile);
	}

    csvfile = window.URL.createObjectURL(filedata);
	$("#message1").text("Snapshot exported "+ new Date().toUTCString());
	$('#download').attr("href",csvfile);
	$('#download').show(300);
}
