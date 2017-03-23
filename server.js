/* Rescue Search Panel Backend.
 * This script should run on Heroku
 * Version 0.2 22 March 2017
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

//****** Global Constants
const SESSION_REPORT = 0;
const CSURVEY_REPORT = 1;
const TSURVEY_REPORT = 8;
const PERF_REPORT = 4;
const DATE_FORMAT = "dateformat=DDMMYY";

//********** Global variable (all should begin with a capital letter)
var EnVars;
var APIUSERNAME;
var APIUSERPWD;
var USERS = [];
var LoggedInUsers;		// array of socket ids for all logged in users
var ApiDataNotReady;
var FirstReportNotReady;
var Rep_params,Rep_callback,Rep_socket;	// globals used for API call
var Report1and2;
var AuthUsers = new Object();	

//******* class for chat session data
var Report12 = function() {
		this.sessionID = 0;		//unique
		this.sessionType = 0;
		this.RC = false;	// incident tools used - e.g. remote control sessions
		this.resolved = false;	// how many got resolved using chat without an incident
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
	socket.on('Report12Request',function(data){
		if(isLoggedIn(socket))
		{
			ApiDataNotReady = 0;
//			debugLog("params",data);
			if(isValidParams(data,socket))
			{
				FirstReportNotReady = true;
				setReport(SESSION_REPORT,data,socket);
				Rep_params = "node="+data.id+"&nodetype="+data.idtype;
				Rep_callback = SessReportCallback;
				Rep_socket = socket;
				getReport();
				getCSData();
			}
		}
	});
	
	// customer survey report
	socket.on('CSReportRequest',function(data){
		if(isLoggedIn(socket))
		{
			ApiDataNotReady = 0;
//			debugLog("params",data);
			if(isValidParams(data,socket))
			{
				setReport(CSURVEY_REPORT,data,socket);
				Rep_params = "node="+data.id+"&nodetype="+data.idtype;
				Rep_callback = CSReportCallback;
				Rep_socket = socket;
				getReport();
			}
		}
	});

	// performance report
	socket.on('Report3Request',function(data){
		if(isLoggedIn(socket))
		{
			ApiDataNotReady = 0;
//			debugLog("params",data);
			if(isValidParams(data,socket))
			{
				setReport(PERF_REPORT,data,socket);
				Rep_params = "node="+data.id+"&nodetype="+data.idtype;
				Rep_callback = Report3Callback;
				Rep_socket = socket;
				getReport();
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

function setReport(report,data,socket) {

	var reportArea = "area="+report;
	var dates = "bdate="+data.bdate+"&edate="+data.edate;				

	//getApiData("setDateFormat.aspx",DATE_FORMAT,dummyCallback,socket);
	//sleep(100);
	getApiData("setReportArea.aspx",reportArea,dummyCallback,socket);
	sleep(100);
	getApiData("setReportDate.aspx",dates,dummyCallback,socket);
	sleep(100);
}

function getReport() {
	
	if(ApiDataNotReady)
	{
		console.log("waiting for API response");
		setTimeout(getReport,1000);		// try again a second later
		return;
	}

	getApiData("getReport.aspx",Rep_params,Rep_callback,Rep_socket);
}

function getCSData() {
	
	if(ApiDataNotReady || FirstReportNotReady)
	{
		console.log("waiting for API");
		setTimeout(getCSData,1000);		// try again a second later
		return;
	}

	getApiData("getReport.aspx",Rep_params,CSDataCallback,Rep_socket);
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
			ApiDataNotReady--;
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
	var Hierarchy = new Array();		// Array of configured users in Rescue
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
//		console.log("API Request Status: "+arr[0]);
		return(socket.emit('errorResponse',arr[0]));
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
			if(tools.indexOf("RC") >= 0)			// if a remote control session
				csession.RC = true;
			csession.resolved = head[resIndex];
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
	sleep(100);
	FirstReportNotReady = false;
}

//Customer survey report - amend to report 1 and 2 data.
//When converted to array first element is OK second is blank and third is the header
function CSDataCallback(data,socket) {
	var sourceIndex,SIDIndex,dateIndex,usernameIndex,rateIndex,technameIndex,techIDIndex,commentIndex;
	var sid,rating,comment;
	var scount = 0;
	var sdata = data.toString();
	var arr = new Array();
	var head = new Array();
	arr = sdata.split("\n");
	if(arr[0] !== "OK")			// API request not successful
	{
		console.log("API Request Status: "+arr[0]);
		return(socket.emit('errorResponse',arr[0]));
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
		else if(head[i].includes("comments"))
			commentIndex = i;
		else if(head[i] == "Technician Name")
			technameIndex = i;
		else if(head[i] == "Technician ID")
			techIDIndex = i;
	}
	
//		console.log("No. of entries:"+arr.length);
	for(var i=3;i < arr.length;i++)	// first line is OK, then blank, then header line
	{
		var head = arr[i].split("|");
		if(typeof head[SIDIndex] != 'undefined')
		{
			sid = head[SIDIndex];
			rating = head[rateIndex];
			comment = head[commentIndex];
			scount++;
			for(var j in Report1and2)		// add to report
			{
				if(sid == Report1and2[j].sessionID)
				{
					Report1and2[j].surveyScore = rating;
					Report1and2[j].surveyComment = comment;
				}
			}
		}
	}
	console.log("No. Surveys: "+scount);
	socket.emit('Report12Response',Report1and2);
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
		return(socket.emit('errorResponse',arr[0]));
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
		return(socket.emit('errorResponse',arr[0]));
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
		return(socket.emit('errorResponse',arr[0]));
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