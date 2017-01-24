/* Rescue Search Panel Backend.
 * This script should run on Heroku
 * Version 0.1 Jan 2017
 */

//****** Set up Express Server and socket.io
var http = require('http');
var https = require('https');
var app = require('express')();
var	server = http.createServer(app);
var	io = require('socket.io').listen(server);
var fs = require('fs');
var crypto = require('crypto');
var bodyParser = require('body-parser');
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

//********** Get port used by Heroku or use a default
var PORT = Number(process.env.PORT || 7979);
server.listen(PORT);

//********** Global variable (all should begin with a capital letter)
var EnVars;
var APIUSERNAME;
var APIUSERPWD;
var USERS = [];
var Hierarchy;		// Array of configured users in Rescue
var LoggedInUsers;		// array of socket ids for all logged in users
var AuthUsers = new Object();	

//******* class for chat session data
var CSession = function() {
		this.sessionID = 0;		//unique
		this.sessionType = 0;
		this.tools = 0;	// incident tools used - e.g. remote control sessions
		this.resolved = 0;	// how many got resolved using chat without an incident
		this.name = "";		// agent name
		this.department = "";	// agent's dept
		this.start = 0;	// start time
		this.end = 0;	// end time
		this.response = 0;	// time taken for agent to pick up the session
};

//******* class for hierarchy (configured user) data
var Cuser = function() {
		this.nodeID = 0;	// unique
		this.name = "";		// user name
		this.type = "";		// account type
};

//******* class for customer survey data
var CSurvey = function() {
		this.sessionID = 0;		//unique
		this.source = "";		// which group
		this.date = "";	// date and time
		this.username = "";	// end username
		this.rating = "";		// rating
		this.techname = "";	// technician name
		this.techID = 0;	// technician ID
};

//******* Get BoldChat API Credentials
console.log("Reading API variables from config.json file...");

try
{
	EnVars = JSON.parse(fs.readFileSync('config.json', 'utf8'));
	APIUSERNAME = EnVars.APIUSERNAME || 0;
	APIUSERPWD = EnVars.APIUSERPWD || 0;
	USERS = EnVars.USERS || 0;
//	debugLog("USER",USERS[0]);
}
catch(e)
{
	if(e.code === 'ENOENT')
	{
		console.log("Config file not found, Reading Heroku Environment Variables");
		APIUSERNAME = process.env.APIUSERNAME || 0;
		APIUSERPWD = process.env.APIUSERPWD || 0;
		USERS = JSON.parse(process.env.USERS) || {};
	}
	else
		console.log("Error code: "+e.code);
}

if(APIUSERNAME == 0 || APIUSERPWD == 0)
{
	console.log("Rescue credentials missing. Terminating!");
	process.exit(1);
}

loadUserCredentials();
console.log("Config loaded successfully");
//****** process valid URL requests
app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});
app.get('/favicon.ico', function(req, res){
	res.sendFile(__dirname + '/favicon.ico');
});
app.get('/lmilogo.png', function(req, res){
	res.sendFile(__dirname + '/lmilogo.png');
});
app.get('/index.js', function(req, res){
	res.sendFile(__dirname + '/index.js');
});

// Set up socket actions and responses
io.on('connection', function(socket){
	//  authenticate user name and password
	socket.on('signinRequest', function(user){
		console.log("Signin request received for: "+user.username);
		if(typeof(AuthUsers[user.username]) === 'undefined')
		{
			socket.emit('errorResponse',"Username not valid");
		}
		else if(validPassword(user.password,AuthUsers[user.username]) == false)
		{
			socket.emit('errorResponse',"Password not valid");
		}
		else
		{
//			console.log("Save socket "+socket.id);
			LoggedInUsers[socket.id] = true;		// save the socketid so that updates can be sent
			io.sockets.sockets[user.username] = socket.id;
			socket.emit('signinResponse',{username: user.username,password: user.password});
		}

	});

	socket.on('disconnect', function(data){
		removeSocket(socket.id, "disconnect");
	});

	socket.on('end', function(data){
		removeSocket(socket.id, "end");
	});

	socket.on('error', function(data){
		console.log("Socket Error");
	});

	socket.on('connect_timeout', function(data){
		removeSocket(socket.id, "timeout");
	});

	socket.on('hierarchyRequest',function(data){
		if(isLoggedIn(socket))
		{
			console.log("Hierarchy requested");
			getApiData("getHierarchy.aspx","",hierarchyCallback,socket);
		}
	});
	
	// session report (report area=0)
	socket.on('reportByChannelRequest',function(data){
		if(isLoggedIn(socket))
		{
			debugLog("params",data);
			if(isValidParams(data,socket))
			{
				getApiData("setDateFormat.aspx","dateformat=DDMMYY",dummyCallback,socket);
				sleep(500);
				getApiData("setReportArea.aspx","area=0",dummyCallback,socket);
				sleep(500);
				getApiData("setReportDate.aspx","bdate="+data.bdate+"&edate="+data.edate,dummyCallback,socket);
				sleep(500);
				getApiData("getReport.aspx","node="+data.id+"&nodetype=CHANNEL",reportCallback,socket);
			}
		}
	});
	
	// session report (report area=0)
	socket.on('reportByNodeRequest',function(data){
		if(isLoggedIn(socket))
		{
			debugLog("params",data);
			if(isValidParams(data,socket))
			{
				getApiData("setDateFormat.aspx","dateformat=MMDDYY",dummyCallback,socket);
				sleep(500);
				getApiData("setReportArea.aspx","area=0",dummyCallback,socket);
				sleep(500);
				getApiData("setReportDate.aspx","bdate="+data.bdate+"&edate="+data.edate,dummyCallback,socket);
				sleep(500);
				getApiData("getReport.aspx","node="+data.id+"&nodetype=NODE",reportCallback,socket);
			}
		}
	});
	
	// customer survey report
	socket.on('CSReportByChannelRequest',function(data){
		if(isLoggedIn(socket))
		{
			debugLog("params",data);
			if(isValidParams(data,socket))
			{
				getApiData("setDateFormat.aspx","dateformat=MMDDYY",dummyCallback,socket);
				sleep(500);
				getApiData("setReportArea.aspx","area=1",dummyCallback,socket);
				sleep(500);
				getApiData("setReportDate.aspx","bdate="+data.bdate+"&edate="+data.edate,dummyCallback,socket);
				sleep(500);
				getApiData("getReport.aspx","node="+data.id+"&nodetype=CHANNEL",CSreportCallback,socket);
			}
		}
	});
	// customer survey report
	socket.on('CSreportByNodeRequest',function(data){
		if(isLoggedIn(socket))
		{
			debugLog("params",data);
			if(isValidParams(data,socket))
			{
				getApiData("setDateFormat.aspx","dateformat=DDMMYY",dummyCallback,socket);
				sleep(500);
				getApiData("setReportArea.aspx","area=1",dummyCallback,socket);
				sleep(500);
				getApiData("setReportDate.aspx","bdate="+data.bdate+"&edate="+data.edate,dummyCallback,socket);
				sleep(500);
				getApiData("getReport.aspx","node="+data.id+"&nodetype=NODE",CSreportCallback,socket);
			}
		}
	});
});

/*process.on('uncaughtException', function (err) {
	var estr = 'Exception: ' + err;
	console.log(estr);
});
*/
console.log("Server started on port "+PORT);
doStartOfDay();		// initialise everything
getApiData("requestAuthCode.aspx","email="+APIUSERNAME+"&pwd="+APIUSERPWD,authcodeCallback);

/*
 ************* Everything below this are functions **********************************
 */

 // load list of users and their passwords
function loadUserCredentials() {
	var au = [];
	au = USERS;
	for(var i=0;i < au.length;i++)
	{
		var uname = au[i].name;
		var pwd = au[i].password;
		AuthUsers[uname] = pwd;
		console.log("User: "+uname+" saved");
	}
	console.log(Object.keys(AuthUsers).length +" user credentials loaded");
}

function validPassword(plain,hashed) {

	var hash = crypto.createHash('sha1');
	hash.update(plain);
	var hex = hash.digest('hex')
//	console.log("Sha1 is:"+hex);
	if(hex == hashed)
		return true;
	
	return false;
}

function initialiseGlobals() {
	Hierarchy = new Array();		// Array of configured users in Rescue
	LoggedInUsers = new Object();
}

function doStartOfDay() {
	initialiseGlobals();	// zero all memory
}

function sleep(milliseconds) {
	var start = new Date().getTime();
	for(var i = 0; i < 1e7; i++)
	{
		if((new Date().getTime() - start) > milliseconds)
		{
			break;
		}
	}
}

function postToArchive(postdata) {
	var options = {
		host : 'uber-electronics.com',
		port : 443,
		path : '/home/mkerai/APItriggers/.php',
		method : 'POST',
		headers: {
          'Content-Type': 'text/plain',
          'Content-Length': Buffer.byteLength(postdata)
		}
	};
	var post_req = https.request(options, function(res){
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
//			console.log('Response: ' + chunk);
			});
		});
	post_req.write(postdata);
	post_req.end();
	post_req.on('error', function(err){console.log("HTML error"+err.stack)});
	console.log("End of day archived successfully");
}

function debugLog(name, dataobj) {
	console.log(name+": ");
	for(key in dataobj)
	{
		if(dataobj.hasOwnProperty(key))
			console.log(key +":"+dataobj[key]);
	}
}

function isLoggedIn(tsock) {
	if(typeof(LoggedInUsers[tsock.id]) === 'undefined')
	{
		tsock.emit('errorResponse',"Please login");
		return false;		
	}
	return true;
}

function isValidParams(params,tsock) {
	if(params.id === undefined || !(params.id.match(/^[0-9]+$/) != null))
	{
		tsock.emit('errorResponse',"ID is incorrect");
		return;		
	}
	if(params.bdate === undefined || validateDate(params.bdate) == false)
	{
		tsock.emit('errorResponse',"Start date is incorrect");
		return;		
	}
	if(params.edate === undefined || validateDate(params.edate) == false)
	{
		tsock.emit('errorResponse',"End date is incorrect");
		return;		
	}		
	
	return true;
}

function Rescue_API_Request(method,params,callBackFunction) {
	var req;
	
	if(method == "requestAuthCode.aspx")
		req = '/API/requestAuthCode.aspx?'+params;
	else
		req = '/API/'+method+'?authcode='+AUTHCODE+'&'+params;
	
	var options = {
		host : 'secure.logmeinrescue.com', 
		port : 443, 
//		path : '/API/'+method+'?'+params, 
		path : req, 
		method : 'GET'
		};
	https.request(options,callBackFunction).end();
}

// calls extraction API and receives formatted strings (no JSON)
function getApiData(method,params,fcallback,cbparam) {
	Rescue_API_Request(method,params,function(response)
	{
		var str = '';
		//another chunk of data has been received, so append it to `str`
		response.on('data',function(chunk) {
			str += chunk;
		});
		//the whole response has been received, take final action.
		response.on('end',function () {
			var data = str;
			if(data === 'undefined' || data == null)
			{
				console.log("No data returned: "+str);
				return;		// exit out if error json message received
			}
			fcallback(data,cbparam);
		});
		// in case there is a html error
		response.on('error', function(err) {
		// handle errors with the request itself
		console.error("Error with the request: ", err.message);
		});
	});
}

function authcodeCallback(data) {
	var n;
	if((n = data.indexOf("AUTHCODE:")) != -1)		// contains authcode
	{
		AUTHCODE = data.substring(n+9);
//		console.log("Authcode is: "+AUTHCODE);
	}
	else
	{
		console.log("Response is: "+data);
		console.log("Rescue ceredentials not valid, terminating!");
		process.exit(1);
	}
}

function genericCallback(data,tsock) {
	console.log(data);
	tsock.emit('goodResponse',data);
}

function dummyCallback(data,tsock) {
	console.log(data);
}

function hierarchyCallback(data,tsock) {
	var str = "";
	var pindex,nindex,eindex,tindex;
	var nid = "";
	var line;
	var sdata = data.toString();
	var arr = new Array();
	arr = sdata.split("NodeID:");
	if(arr[0].includes("OK") == false)			// API request not successful
	{
		console.log("API Request Status: "+arr[0]);
		tsock.emit('errorResponse',arr[0]);
		return;
	}
// line format is: 15988113 ParentID:2715315 Name:Manji Kerai Email:mkerai@logmein.com Description: some text Status:Offline Type:MasterAdministrator	
// parse above line and convert to array of objects
	for(var i=2;i < arr.length;i++)	// first line is OK, then blank, then the data
	{
		var th = new Cuser();
		line = arr[i];
//		console.log("Line is:"+line);
		pindex = line.indexOf("ParentID:");
		nindex = line.indexOf("Name:");
		eindex = line.indexOf("Email:");
		tindex = line.indexOf("Type:");
		th.nodeID = line.substring(0,pindex-1);
		th.name = line.substring(nindex+5,eindex-1);
		th.type = line.substring(tindex+5);
		Hierarchy.push(th);
	}
	tsock.emit('hierarchyResponse',Hierarchy);
}

//Session report.
//When converted to array first element is OK second is blank and third is the header
function reportCallback(data,tsock) {
	var waitIndex,resIndex,toolIndex,typeIndex,SIDIndex,tgroupIndex,tnameIndex,endIndex,startIndex;
	var tsession;
	var sdata = data.toString();
	var CSessions = new Array();
	var arr = new Array();
	var head = new Array();
	arr = sdata.split("\n");
	if(arr[0] !== "OK")			// API request not successful
	{
//		console.log("API Request Status: "+arr[0]);
		return(tsock.emit('errorResponse',arr[0]));
	}
	
	var header = arr[2];	
//	console.log("header: "+header);
	head = header.split("|");
	for(var i in head)
	{
		if(head[i] == "Start Time")
			startIndex = i;
		else if(head[i] == "End Time")
			endIndex = i;
		else if(head[i] == "Technician Name")
			tnameIndex = i;
		else if(head[i] == "Technician Group")
			tgroupIndex = i;
		else if(head[i] == "Session ID")
			SIDIndex = i;
		else if(head[i] == "Session Type")
			typeIndex = i;
		else if(head[i] == "Incident Tools Used")
			toolIndex = i;
		else if(head[i] == "Resolved Unresolved")
			resIndex = i;
		else if(head[i] == "Waiting Time")
			waitIndex = i;	
	}
	
//		console.log("No. of entries:"+arr.length);
	for(var i=3;i < arr.length;i++)	// first line is OK, then blank, then header line
	{
		tsession = arr[i];	
		var head = tsession.split("|");
		if(typeof head[SIDIndex] != 'undefined')
		{
			var csession = new CSession();
			csession.sessionID = head[SIDIndex];
			csession.sessionType = head[typeIndex];
			csession.tools = head[toolIndex];
			csession.resolved = head[resIndex];
			csession.name = head[tnameIndex];
			csession.department = head[tgroupIndex];
			csession.start = head[startIndex];
			csession.end = head[endIndex];
			csession.response = head[waitIndex];
			CSessions.push(csession);		// add to list
		}
	}
	console.log("No. Chat sessions: "+CSessions.length);
	tsock.emit('reportByChannelResponse',CSessions);
}

//Customer survey report.
//When converted to array first element is OK second is blank and third is the header
function CSreportCallback(data,tsock) {
	var sourceIndex,SIDIndex,dateIndex,usernameIndex,rateIndex,technameIndex,techIDIndex;
	var tsurvey;
	var sdata = data.toString();
	var CSurveys = new Array();
	var arr = new Array();
	var head = new Array();
	arr = sdata.split("\n");
	if(arr[0] !== "OK")			// API request not successful
	{
//		console.log("API Request Status: "+arr[0]);
		return(tsock.emit('errorResponse',arr[0]));
	}
	
	var header = arr[2];	
//	console.log("header: "+header);
	head = header.split("|");
	for(var i in head)
	{
		if(head[i] == "Source")
			sourceIndex = i;
		else if(head[i] == "Session ID")
			SIDIndex = i;
		else if(head[i] == "Date")
			dateIndex = i;
		else if(head[i] == "End user's First name")
			usernameIndex = i;
		else if(head[i].includes("Please rate your product"))
			rateIndex = i;
		else if(head[i] == "Technician Name")
			technameIndex = i;
		else if(head[i] == "Technician ID")
			techIDIndex = i;
	}
	
//		console.log("No. of entries:"+arr.length);
	for(var i=3;i < arr.length;i++)	// first line is OK, then blank, then header line
	{
		tsurvey = arr[i];	
		var head = tsurvey.split("|");
		if(typeof head[SIDIndex] != 'undefined')
		{
			var csurvey = new CSurvey();
			csurvey.sessionID = head[SIDIndex];
			csurvey.source = head[sourceIndex];
			csurvey.date = head[dateIndex];
			csurvey.username = head[usernameIndex];
			csurvey.rating = head[rateIndex];
			csurvey.techname = head[technameIndex];
			csurvey.techID = head[techIDIndex];
			CSurveys.push(csurvey);		// add to list
		}
	}
	console.log("No. Surveys: "+CSurveys.length);
	tsock.emit('CSReportByChannelResponse',CSurveys);
}

function removeSocket(id, evname) {
	console.log("Socket "+evname+" at "+ new Date().toString());
	LoggedInUsers[id] = undefined;		// remove from list of valid users
}

// validates string is format MM/DD/YYYY with year being 20xxx
function validateDate(testdate) {
    var date_regex = /^(0[1-9]|1[0-2])\/(0[1-9]|1\d|2\d|3[01])\/(20)\d{2}$/ ;
    return date_regex.test(testdate);
}