/* Rescue Search Panel Backend.
 * This script should run on Heroku
 * Version 0.3 30 March 2017
 */

//****** Set up Express Server and socket.io
var http = require('http');
var https = require('https');
var app = require('express')();
var fs = require('fs');
var crypto = require('crypto');
var bodyParser = require('body-parser');
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

//********** Get port used by Heroku or use a default
var PORT = Number(process.env.PORT || 7979);
var server = http.createServer(app).listen(PORT);
var	io = require('socket.io').listen(server);

//****** Global Constants
const SESSION_REPORT = 0;
const CSURVEY_REPORT = 1;
const TSURVEY_REPORT = 8;
const PERF_REPORT = 4;
const DATE_FORMAT = "dateformat=DDMMYY";
const REPORTROOM = "auto_perf_report";	// socket room name for auto reports

//********** Global variable (all should begin with a capital letter)
var EnVars;
var APIUSERNAME;
var APIUSERPWD;
var AUTHCODE;
var USERS = [];
var IDFORAUTO;	// rescue hierarchy ID for auto refresh
var IDTYPEAUTO;	// id type - channel or node
var ENVIRONMENT;
var Hierarchy;
var LoggedInUsers;		// array of socket ids for all logged in users
var ApiDataNotReady = 0;
var ReportInProgress;
var FirstReportReady;
var Report1and2;
var R2timer;
var R1timer;
var AutoRtimer;
var AuthUsers = new Object();
var AutoReport = new Array();
var EndOfDay;

//******* class for chat session data
var Report12 = function() {
		this.sessionID = 0;		//unique
		this.sessionType = 0;
		this.RC = false;	// incident tools used - e.g. remote control sessions
		this.resolved = "";	// how many got resolved using chat without an incident
		this.name = "";		// agent name
		this.department = "";	// agent's dept
		this.start = 0;	// start time
		this.end = 0;	// end time
		this.waitTime = 0;	// time taken for agent to pick up the session
		this.totalTime = 0;	// 
		this.activeTime = 0;	//
		this.workTime = 0;	// 
		this.wrapTime = 0;	// 
		this.surveyScore = "";	// Score from customer sat survey
		this.surveyComment = "";	// feedback text from CSAT survey
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
		this.techName = "";	// technician name
		this.techID = 0;	// technician ID
};

//******* class for technician survey data
var TSurvey = function() {
		this.sessionID = 0;		//unique
		this.source = "";		// which group
		this.date = "";	// date and time
		this.username = "";	// end username
		this.evaluate = "";		// tech evaluation
		this.techName = "";	// technician name
		this.techID = 0;	// technician ID
};

//******* class for tech performance data
var TPerformance = function() {
		this.techName = "";	// technician name
		this.techID = 0;	// technician ID
		this.noOfSessions = 0;	// number of sessions
		this.totalTime = "";	// total login time
		this.avgPickup = "";	// average pickup speed
		this.avgDuration = "";		// average duration
		this.avgWorkTime = "";		// average work time
		this.totalActiveTime = "";		// total active time
		this.totalWorkTime = "";		//  work time
};

//******* Get BoldChat API Credentials
console.log("Reading API variables from config.json file...");

try
{
	EnVars = JSON.parse(fs.readFileSync('config.json', 'utf8'));
	APIUSERNAME = EnVars.APIUSERNAME || 0;
	APIUSERPWD = EnVars.APIUSERPWD || 0;
	USERS = EnVars.USERS || [];
	ENVIRONMENT = EnVars.ENVIRONMENT || "Error";
	IDFORAUTO = EnVars.IDFORAUTO || 0;		
	IDTYPEAUTO = EnVars.IDTYPEAUTO || 0;		
	console.log("Env is: "+ENVIRONMENT);
//	debugLog("USER",USERS[0]);
}
catch(e)
{
	if(e.code === 'ENOENT')
	{
		console.log("Config file not found, Reading Heroku Environment Variables");
		APIUSERNAME = process.env.APIUSERNAME || 0;
		APIUSERPWD = process.env.APIUSERPWD || 0;
		USERS = JSON.parse(process.env.USERS) || [];
		ENVIRONMENT = process.env.ENVIRONMENT || "Error";
		IDFORAUTO = process.env.IDFORAUTO || 0;		
		IDTYPEAUTO = process.env.IDTYPEAUTO || 0;		
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
console.log("Server started on port "+PORT);
getApiData("requestAuthCode.aspx","email="+APIUSERNAME+"&pwd="+APIUSERPWD,authcodeCallback);
sleep(200);
doStartOfDay();		// initialise everything

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
app.get('/manji.html', function(req, res){
	res.sendFile(__dirname + '/manji.html');
});
app.get('/manji.js', function(req, res){
	res.sendFile(__dirname + '/manji.js');
});
app.get('/index.js', function(req, res){
	res.sendFile(__dirname + '/index.js');
});
/* mscala */
app.get('/ajax-loader.gif', function(req, res){
	res.sendFile(__dirname + '/ajax-loader.gif');
});
app.get('/chosen-sprite@2x.png', function(req, res){
	res.sendFile(__dirname + '/chosen-sprite@2x.png');
});
app.get('/chosen-sprite@2x.png', function(req, res){
	res.sendFile(__dirname + '/chosen-sprite@2x.png');
});
app.get('/jquery-ui-1.12.1/*', function(req, res){
	res.sendFile(__dirname + req.path);
});
/* end mscala */

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
		removeSocket(socket.id, "Socket Error");
		console.log("Socket Error");
	});

	socket.on('connect_timeout', function(data){
		removeSocket(socket.id, "timeout");
	});

	socket.on('hierarchyRequest',function(data){
		if(isLoggedIn(socket))
		{
			console.log("Hierarchy requested");
			socket.emit('hierarchyResponse',Hierarchy);
		}
	});
	
	// session report (report area=0)
	socket.on('Report12Request',function(data){
		if(isLoggedIn(socket) && checkReportStatus(socket))
		{
			ApiDataNotReady = 0;
//			debugLog("params",data);
			if(isValidParams(data,socket))
			{
				ReportInProgress = true;
				FirstReportReady = false;
				setReport(SESSION_REPORT,data,socket);
				var params = "node="+data.id+"&nodetype="+data.idtype;
				getReport1(params,SessReportCallback,socket);
				getReport2(params,CSDataCallback,socket);
			}
		}
	});

	// performance report
	socket.on('Report3Request',function(data){
		if(isLoggedIn(socket) && checkReportStatus(socket))
		{
			ApiDataNotReady = 0;
			debugLog("params",data);
			if(isValidParams(data,socket))
			{
				ReportInProgress = true;
				setReport(PERF_REPORT,data,socket);
				var params = "node="+data.id+"&nodetype="+data.idtype;
				getReport1(params,Report3Callback,socket);
			}
		}
	});
	
	// customer survey report only
	socket.on('CSReportRequest',function(data){
		if(isLoggedIn(socket) && checkReportStatus(socket))
		{
			ApiDataNotReady = 0;
			debugLog("params",data);
			if(isValidParams(data,socket))
			{
				ReportInProgress = true;
				setReport(CSURVEY_REPORT,data,socket);
				var params = "node="+data.id+"&nodetype="+data.idtype;
				getReport1(params,CSDataCallback,socket);
			}
		}
	});
	
	// join room which does the report every 3 mins and multicasts it to all subscribers
	socket.on('join room',function(room){
		if(isLoggedIn(socket))
		{
			console.log("Joining room "+room);
			socket.join(room);
			socket.emit('AutoReportResponse',AutoReport);
		}
	});
	
	socket.on('leave room',function(room){
		console.log("Leaving room "+room);
		socket.leave(room);
	});
});

/*process.on('uncaughtException', function (err) {
	var estr = 'Exception: ' + err;
	console.log(estr);
});
*/
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
	LoggedInUsers = new Object();
	Hierarchy = new Array();		// Array of configured users in Rescue
	EndOfDay = new Date();
	EndOfDay.setHours(23,59,59,999);	// last milli second of the day
}

function doStartOfDay() {
	initialiseGlobals();	// zero all memory
	getHierachy();
	AutoRtimer = setInterval(runAutoReport,60000);	// run every minute
}

// This runs forever but only when no other report is running as the API only allows single report capability
function runAutoReport() {
	if(ReportInProgress)	// only run when no other report is requested
		return;

	var timeNow = new Date();		// update the time for all calculations
	if(timeNow > EndOfDay)		// we have skipped to a new day
	{
		console.log(TimeNow.toISOString()+": New day started, stats reset");
		clearTimeout(R1timer);
		clearTimeout(R2timer);
		clearInterval(AutoRtimer);
		setTimeout(doStartOfDay,10000);	//restart after 10 seconds to give time for ajaxes to complete
		return;
	}
	ApiDataNotReady = 0;
	var data = new Object();
	data["id"] = IDFORAUTO;
	data["idtype"] = IDTYPEAUTO;
	data["bdate"] = getFormattedDate();	// gives today's date in mm/dd/yyyy
	data["edate"] = getFormattedDate();
	if(isValidParams(data,io.sockets.in(REPORTROOM)))
	{
		ReportInProgress = true;
		setReport(PERF_REPORT,data,io.sockets.in(REPORTROOM));
		var params = "node="+data.id+"&nodetype="+data.idtype;
		getReport1(params,autoReportCallback,io.sockets.in(REPORTROOM));
	}	
}

function setReport(report,data,socket) {

	var reportArea = "area="+report;
	var dates = "bdate="+data.bdate+"&edate="+data.edate;				

	getApiData("setReportArea.aspx",reportArea,dummyCallback,socket);
	sleep(200);
	getApiData("setReportDate.aspx",dates,dummyCallback,socket);
	sleep(200);
}

function getHierachy() {
	
	if(ApiDataNotReady)
	{
		console.log("Waiting for hierarchy");
		setTimeout(getHierachy,1000);		// try again a second later
		return;
	}
	getApiData("getHierarchy.aspx","",hierarchyCallback);
}

function getReport1(params,callback,socket) {
	
	if(ApiDataNotReady)
	{
		console.log("Waiting for API response1");
		R1timer = setTimeout(function (){getReport1(params,callback,socket)},1000);		// try again a second later
		return;
	}
	getApiData("getReport.aspx",params,callback,socket);
}

function getReport2(params,callback,socket) {
	
	if(ApiDataNotReady || !FirstReportReady)
	{
		console.log("Waiting for API response2");
		R2timer = setTimeout(function (){getReport2(params,callback,socket)},1000);		// try again a second later
		return;
	}
	getApiData("getReport.aspx",params,callback,socket);
}

function debugLog(name, dataobj) {
	console.log(name+": ");
	for(key in dataobj)
	{
		if(dataobj.hasOwnProperty(key))
			console.log(key +":"+dataobj[key]);
	}
}

function isLoggedIn(socket) {
	if(typeof(LoggedInUsers[socket.id]) === 'undefined')
	{
		socket.emit('errorResponse',"Please login");
		return false;		
	}			
	return true;
}

function checkReportStatus(socket) {
	if(ReportInProgress)
	{
		socket.emit('errorResponse', "Report already in progress, try again later");
		return false;		
	}			
	return true;
}

function reportError(emsg,socket) {
	socket.emit('errorResponse', emsg);
	ReportInProgress = false;
}

function isValidParams(params,tsock) {
	if(typeof params.id != 'string')
	{
		tsock.emit('errorResponse',"ID appears to be incorrect");
		return false;		
	}
	if(typeof params.id === 'undefined' || !(params.id.match(/^[0-9]+$/)))
	{
		tsock.emit('errorResponse',"ID is incorrect");
		return false;		
	}
	if(typeof params.bdate === 'undefined' || validateDate(params.bdate) == false)
	{
		tsock.emit('errorResponse',"Start date is incorrect");
		return false;		
	}
	if(typeof params.edate === 'undefined' || validateDate(params.edate) == false)
	{
		tsock.emit('errorResponse',"End date is incorrect");
		return false;		
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
	ApiDataNotReady++;
	Rescue_API_Request(method,params,function(response)
	{
		var str = '';
		//another chunk of data has been received, so append it to `str`
		response.on('data',function(chunk) {
			str += chunk;
		});
		//the whole response has been received, take final action.
		response.on('end',function () {
			ApiDataNotReady--;
			var data = str;
			if(typeof data === 'undefined' || data == null)
			{
				reportError("No data returned: "+str,cbparam);
				return;		// exit out if error json message received
			}
			fcallback(data,cbparam);
		});
		// in case there is a html error
		response.on('error',function(err) {
		// handle errors with the request itself
			ApiDataNotReady--;
			console.error("Error with the request: ",err.message);
			reportError("Error with the request: ",err.message,cbparam);
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

function hierarchyCallback(data) {
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
		process.exit(1);
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
		if(th.name.indexOf(ENVIRONMENT) != -1)
			Hierarchy.push(th);
	}
	console.log("Hierarchy complete: "+Hierarchy.length);
}

//Session report.
//When converted to array first element is OK second is blank and third is the header
function SessReportCallback(data,socket) {
	var resIndex,toolIndex,typeIndex,SIDIndex,tgroupIndex,tnameIndex,endIndex,startIndex;
	var waitIndex,totalIndex,activeIndex,workIndex,wrapIndex;
	var tsession,tools;
	var sdata = data.toString();
	var arr = new Array();
	var head = new Array();
	arr = sdata.split("\n");
	if(arr[0] !== "OK")			// API request not successful
	{
		console.log("API Request: "+arr[0]);
		clearTimeout(R2timer);		// clear the report 2 timer if running
		reportError("API Request: "+arr[0],socket);
		return;
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
//		else if(head[i] == "Resolved Unresolved")	// not used for accenture, use the field in CS report
//			resIndex = i;
		else if(head[i] == "Waiting Time")
			waitIndex = i;	
		else if(head[i] == "Total Time")
			totalIndex = i;	
		else if(head[i] == "Active Time")
			activeIndex = i;	
		else if(head[i] == "Work Time")
			workIndex = i;	
		else if(head[i] == "Wrap Time")
			wrapIndex = i;	
	}
	
	Report1and2 = new Array();		// initialise report array
//		console.log("No. of entries:"+arr.length);
	for(var i=3;i < arr.length;i++)	// first line is OK, then blank, then header line
	{
		tsession = arr[i];
		tools = "";
		head = tsession.split("|");
		if(typeof head[SIDIndex] != 'undefined')
		{
			var csession = new Report12();
			csession.sessionID = head[SIDIndex];
			csession.sessionType = head[typeIndex];
			tools = head[toolIndex];
			if(typeof tools !== 'undefined')
				if(tools.indexOf("RC") >= 0)			// if a remote control session
					csession.RC = true;
//			csession.resolved = head[resIndex];
			csession.name = head[tnameIndex];
			csession.department = head[tgroupIndex];
			csession.start = head[startIndex];
			csession.end = head[endIndex];
			csession.waitTime = head[waitIndex];
			csession.totalTime = head[totalIndex];
			csession.activeTime = head[activeIndex];
			csession.workTime = head[workIndex];
			csession.wrapTime = head[wrapIndex];
			Report1and2.push(csession);		// add to list
		}
	}
	console.log("No. Chat sessions: "+Report1and2.length);
	// now get CS survey data and tag on to this array
	getApiData("setReportArea.aspx","area="+CSURVEY_REPORT,dummyCallback,socket);
	sleep(500);
	FirstReportReady = true;
}

//Customer survey report - amend to report 1 and 2 data.
//When converted to array first element is OK second is blank and third is the header
function CSDataCallback(data,socket) {
	var sourceIndex,SIDIndex,dateIndex,usernameIndex,rateIndex,technameIndex,techIDIndex,commentIndex,resIndex;
	var sid,rating,comment,resolved;
	var scount = 0;
	var sdata = data.toString();
	var arr = new Array();
	var head = new Array();
	arr = sdata.split("\n");
	if(arr[0] !== "OK")			// API request not successful
	{
		console.log("API Request Status: "+arr[0]);
		return(reportError(arr[0],socket));
	}
	
	var header = arr[2];	
	console.log("header: "+header);
	head = header.split("|");
	for(var i in head)
	{
		if(head[i] == "Source")
			sourceIndex = i;
		else if(head[i] == "Session ID")
			SIDIndex = i;
		else if(head[i] == "Date")
			dateIndex = i;
		else if(head[i] == "Name")
			usernameIndex = i;
		else if(head[i].includes("problem?"))
			resIndex = i;
		else if(head[i].includes("Please rate your"))
			rateIndex = i;
		else if(head[i].includes("comments?"))
			commentIndex = i;
		else if(head[i] == "Technician Name")
			technameIndex = i;
		else if(head[i] == "Technician ID")
			techIDIndex = i;
	}
	
//		console.log("No. of entries:"+arr.length);
	for(var i=3;i < arr.length;i++)	// first line is OK, then blank, then header line
	{
//		console.log(arr[i]+"\n");
		var head = arr[i].split("|");
		if(typeof head[SIDIndex] != 'undefined')
		{
			sid = head[SIDIndex];
			resolved = head[resIndex];
			rating = head[rateIndex];
			comment = head[commentIndex];
			scount++;
			for(var j in Report1and2)		// add to report
			{
				if(sid == Report1and2[j].sessionID)
				{
					Report1and2[j].resolved = resolved;
					Report1and2[j].surveyScore = rating;
					Report1and2[j].surveyComment = comment;
				}
			}
		}
	}
	console.log("No. Surveys: "+scount);
	socket.emit('Report12Response',Report1and2);
	ReportInProgress = false;
}

//Customer survey report standalone.
//When converted to array first element is OK second is blank and third is the header
function CSReportCallback(data,socket) {
	var sourceIndex,SIDIndex,dateIndex,usernameIndex,rateIndex,technameIndex,techIDIndex;
	var sdata = data.toString();
	var arr = new Array();
	var head = new Array();
	arr = sdata.split("\n");
	if(arr[0] !== "OK")			// API request not successful
	{
		console.log("API Request Status: "+arr[0]);
		return(reportError(arr[0],socket));
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
	var CSurveys = new Array();
	for(var i=3;i < arr.length;i++)	// first line is OK, then blank, then header line
	{
		var head = arr[i].split("|");
		if(typeof head[SIDIndex] != 'undefined')
		{
			var csurvey = new CSurvey();
			csurvey.sessionID = head[SIDIndex];
			csurvey.source = head[sourceIndex];
			csurvey.date = head[dateIndex];
			csurvey.username = head[usernameIndex];
			csurvey.rating = head[rateIndex];
			csurvey.techName = head[technameIndex];
			csurvey.techID = head[techIDIndex];
			CSurveys.push(csurvey);		// add to list
		}
	}
	console.log("No. Surveys: "+CSurveys.length);
	socket.emit('CSReportResponse',CSurveys);
	ReportInProgress = false;
}

//Technician survey report.
//When converted to array first element is OK second is blank and third is the header
function TSReportCallback(data,socket) {
	var sourceIndex,SIDIndex,dateIndex,usernameIndex,evalIndex,technameIndex,techIDIndex;
	var sdata = data.toString();
	var arr = new Array();
	var head = new Array();
	arr = sdata.split("\n");
	if(arr[0] !== "OK")			// API request not successful
	{
//		console.log("API Request Status: "+arr[0]);
		return(reportError(arr[0],socket));
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
		else if(head[i].includes("Please evaluate the session"))
			evalIndex = i;
		else if(head[i] == "Technician Name")
			technameIndex = i;
		else if(head[i] == "Technician ID")
			techIDIndex = i;
	}
	
//		console.log("No. of entries:"+arr.length);
	var TSurveys = new Array();
	for(var i=3;i < arr.length;i++)	// first line is OK, then blank, then header line
	{	
		var head = arr[i].split("|");
		if(typeof head[SIDIndex] != 'undefined')
		{
			var tsurvey = new TSurvey();
			tsurvey.sessionID = head[SIDIndex];
			tsurvey.source = head[sourceIndex];
			tsurvey.date = head[dateIndex];
			tsurvey.username = head[usernameIndex];
			tsurvey.evaluate = head[evalIndex];
			tsurvey.techName = head[technameIndex];
			tsurvey.techID = head[techIDIndex];
			TSurveys.push(tsurvey);		// add to list
		}
	}
	console.log("No. Surveys: "+TSurveys.length);
	socket.emit('TSReportResponse',TSurveys);
	ReportInProgress = false;
}

//Performance report.
//When converted to array first element is OK second is blank and third is the header
function Report3Callback(data,socket) {
	var technameIndex,techIDIndex,nosessIndex,pickupIndex,tltimeIndex,wtimeIndex,durationIndex,tatimeIndex,twtimeIndex;
	var sdata = data.toString();
	var arr = new Array();
	var head = new Array();
	arr = sdata.split("\n");
	if(arr[0] !== "OK")			// API request not successful
	{
//		console.log("API Request Status: "+arr[0]);
		return(reportError(arr[0],socket));
	}
	
	var header = arr[2];	
//	console.log("header: "+header);
	head = header.split("|");
	for(var i in head)
	{
		if(head[i] == "Technician Name")
			technameIndex = i;
		else if(head[i] == "Technician ID")
			techIDIndex = i;
		else if(head[i] == "Number of Sessions")
			nosessIndex = i;
		else if(head[i] == "Total Login Time")
			tltimeIndex = i;
		else if(head[i].includes("Pick-up"))
			pickupIndex = i;
		else if(head[i].includes("Duration"))
			durationIndex = i;
		else if(head[i].includes("Average Work"))
			wtimeIndex = i;	
		else if(head[i].includes("Total Active"))
			tatimeIndex = i;	
		else if(head[i].includes("Total Work"))
			twtimeIndex = i;	
	}
	
//		console.log("No. of entries:"+arr.length);
	var Report3 = new Array();
	for(var i=3;i < arr.length;i++)	// first line is OK, then blank, then header line
	{	
		head = arr[i].split("|");
		if(typeof head[techIDIndex] != 'undefined')
		{
			var tperf = new TPerformance();
			tperf.techName = head[technameIndex];
			tperf.techID = head[techIDIndex];
			tperf.noOfSessions = head[nosessIndex];
			tperf.totalTime = head[tltimeIndex];
			tperf.avgPickup = head[pickupIndex];
			tperf.avgDuration = head[durationIndex];
			tperf.avgWorkTime = head[wtimeIndex];
			tperf.totalActiveTime = head[tatimeIndex];
			tperf.totalWorkTime = head[twtimeIndex];
			Report3.push(tperf);		// add to list
		}
	}
	console.log("No. Technicians: "+Report3.length);
	socket.emit('Report3Response',Report3);
	ReportInProgress = false;
}

//Auto report which is actually the Performance report.
//When converted to array first element is OK second is blank and third is the header
function autoReportCallback(data,rsocket) {
	var technameIndex,techIDIndex,nosessIndex,pickupIndex,tltimeIndex,wtimeIndex,durationIndex,tatimeIndex,twtimeIndex;
	var sdata = data.toString();
	var arr = new Array();
	var head = new Array();
	arr = sdata.split("\n");
	if(arr[0] !== "OK")			// API request not successful
	{
//		console.log("API Request Status: "+arr[0]);
		return(reportError(arr[0],rsocket));
	}
	
	var header = arr[2];	
//	console.log("header: "+header);
	head = header.split("|");
	for(var i in head)
	{
		if(head[i] == "Technician Name")
			technameIndex = i;
		else if(head[i] == "Technician ID")
			techIDIndex = i;
		else if(head[i] == "Number of Sessions")
			nosessIndex = i;
		else if(head[i] == "Total Login Time")
			tltimeIndex = i;
		else if(head[i].includes("Pick-up"))
			pickupIndex = i;
		else if(head[i].includes("Duration"))
			durationIndex = i;
		else if(head[i].includes("Average Work"))
			wtimeIndex = i;	
		else if(head[i].includes("Total Active"))
			tatimeIndex = i;	
		else if(head[i].includes("Total Work"))
			twtimeIndex = i;	
	}
	
	AutoReport = new Array();
//		console.log("No. of entries:"+arr.length);
	for(var i=3;i < arr.length;i++)	// first line is OK, then blank, then header line
	{	
		head = arr[i].split("|");
		if(typeof head[techIDIndex] != 'undefined')
		{
			var tperf = new TPerformance();
			tperf.techName = head[technameIndex];
			tperf.techID = head[techIDIndex];
			tperf.noOfSessions = head[nosessIndex];
			tperf.totalTime = head[tltimeIndex];
			tperf.avgPickup = head[pickupIndex];
			tperf.avgDuration = head[durationIndex];
			tperf.avgWorkTime = head[wtimeIndex];
			tperf.totalActiveTime = head[tatimeIndex];
			tperf.totalWorkTime = head[twtimeIndex];
			AutoReport.push(tperf);		// add to list
		}
	}
	console.log("Auto report done: "+AutoReport.length);
	rsocket.emit('AutoReportResponse',AutoReport);
	ReportInProgress = false;
}


function removeSocket(id, evname) {
	console.log("Socket "+evname+" at "+ new Date().toString());
	LoggedInUsers[id] = undefined;		// remove from list of valid users
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

// validates string is format MM/DD/YYYY with year being 20xxx
function validateDate(testdate) {
    var date_regex = /^(0[1-9]|1[0-2])\/(0[1-9]|1\d|2\d|3[01])\/(20)\d{2}$/ ;
    return date_regex.test(testdate);
}

function getFormattedDate() {
	var date = new Date();
	var year = date.getFullYear();
	var month = (1 + date.getMonth()).toString();
	month = month.length > 1 ? month : '0' + month;
	var day = date.getDate().toString();
	day = day.length > 1 ? day : '0' + day;
	return month + '/' + day + '/' + year;
}