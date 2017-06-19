var socket = io.connect();

// Globals
grouped = false;
selectedEnv = "7539518"; //default env for reports
selectedType = "NODE";	// default type

function getAccount() {
  socket.emit('accountRequest', "");
}

function groupbyagent() {
  (grouped = !grouped) ? $("#mainreport12").tabulator({
    groupBy: "name"
  }): $("#mainreport12").tabulator({
    groupBy: ""
  });
}

function notify(style, txt) {
  $.notify(txt, {
    //style: 'metro',
    className: style,
    autoHide: 5000,
    clickToHide: true,
    position: "bottom center"
  });
}

function joinRoom() {
	socket.emit('join room',"auto_perf_report");
}

function leaveRoom() {
	socket.emit('leave room',"auto_perf_report");
}

function download() {
			var s = $("input[name='reportname']:checked").val(); 
			switch (s){			
			case ("Report12Request"):
			$("#mainreport12").tabulator("download", "csv", moment().format("YYYY-MM-DD hh.mm.ss") + " - SessionSurvey.csv");
			break;
		  case ("Report3Request"):
			$("#mainreport3").tabulator("download", "csv", moment().format("YYYY-MM-DD hh.mm.ss") + " - Performance.csv");
			break;
			case ("AutoPerformance"):
			$("#autoreport").tabulator("download", "csv", moment().format("YYYY-MM-DD hh.mm.ss") + " - Performance.csv");
			break;
			}  
}

function showLoginForm() {
  $("#hierarchy").hide(1000);
  $("#mainreport3").hide(1000);
  $("#mainreport12").hide(1000);
	$("#autoreport").hide(1000);
  $("#groupoption").hide();
  $("#download").hide();
  $("#login").show(1000);
}

function checkSignedIn() {
  var name = readCookie("username");
  var pwd = readCookie("password");
  //console.log("User cookie: "+name+" and pwd "+pwd);
  if (name == null || pwd == null) {
    $('#myname').text("Log Me In");
    $("#login").show(1000);
  } else {
    signin(name, pwd);
  }
}

function signin(uname, pwd) {
  var data = new Object();
  data = {
    "username": uname,
    "password": pwd
  };
  //	console.log("Data object: "+data.name+" and "+data.pwd);
  socket.emit('signinRequest', data);
}

function getHierarchy() {
  $("#login").hide(1000);
  $("#mainreport12").hide(1000);
  $("#mainreport3").hide(1000);
	$("#autoreport").hide(1000);
  $("#groupoption").hide();
  $("#download").hide();
  $("#hierarchy").toggle(1000, function() {
    if ($(this).css("display") == "block") {
      socket.emit('hierarchyRequest', "");
      $("#spinner").show();
    }
  });
}

function getReport() {
  $("#login").hide(1000);
  $("#hierarchy").hide(1000);
  var nid = selectedEnv; //$('#nodeID').val();
  var reptype = selectedType; //$("input[name='reporttype']:checked").val();
  var repname = $("input[name='reportname']:checked").val();
  var bdate = $('#bdate').val();
	var edate = $('#edate').val(); 
  var params = {
    "id": nid,
    "bdate": bdate,
    "edate": edate,
    "idtype": reptype
  };
  socket.emit(repname, params);
  $("#spinner").show();
}

function readCookie(name) {
  name += '=';
  var parts = document.cookie.split(/;\s*/);
  for (var i = 0; i < parts.length; i++) {
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
function saveCookie(name, value, delay) {
  var date, expires;
  if (delay) {
    if (delay < 100) // in days
      delay = delay * 24 * 60 * 60 * 1000; // convert days to milliseconds
    else
      delay = delay * 1000; // seconds to milliseconds
    date = new Date();
    date.setTime(date.getTime() + delay); // delay must be in seconds
    expires = "; expires=" + date.toGMTString(); // convert unix date to string
  } else
    expires = "";
  document.cookie = name + "=" + value + expires + "; path=/";
}
/**DOCUMENT IS READY **/
$(function() {
	
	$('#nodeID').val(selectedEnv);
	
  /* configuration for date/time sorters */
  $.widget("ui.tabulator", $.ui.tabulator, {
    sorters: {
      //datetime sort using moment.js
      datetime: function(a, b) {
        a = moment(a, "MM/DD/YYYY hh:mm");
        b = moment(b, "MM/DD/YYYY hh:mm");
        return a - b;
      },
    },
  });
  /** let's start here **/
  checkSignedIn();
  $('#signinform').submit(function(event) {
    event.preventDefault();
    var name = $('#username').val();
    var pwd = $('#password').val();
    signin(name, pwd);
  });
  socket.on('errorResponse', function(data) {
    notify("error", data);
    $("#spinner").hide();
  });
  socket.on('goodResponse', function(data) {
    $("#message1").html(data);
  });
  socket.on('signinResponse', function(data) {
    saveCookie("username", data.username, 1); // save as cookie for 1 day
    saveCookie("password", data.password, 1);
    $('#myname').text(data.username);
    $("#login").hide(1000);
    notify("success", "Successfully signed in");
  });
  // this returns an array of Cuser objects
  socket.on('hierarchyResponse', function(data) {
    $("#spinner").hide();
    notify("info", "Click on an ID to fill it in the field");
    $("#hierarchy").tabulator("setData", data);
  });
	
	
	$("input[name='reportname']").change(function(){
			var s=$(this).val(); 
			switch (s){			
			case ("Report12Request"):
			  leaveRoom();
				$(".dateinputs").show();
				$("#report").show();
				$("#mainreport12").show();
				$("#download").show();
				$("#groupoption").show();
				
				$("#mainreport3").hide();
				$("#autoreport").hide();
			  $(".roombuttons").hide();
			break;
		  case ("Report3Request"):
			  leaveRoom();
				$(".dateinputs").show();
				$("#report").show();
				$("#download").show();
				$("#mainreport3").show();				

				$("#mainreport12").hide();
				$("#autoreport").hide();
				$("#groupoption").hide();
			  $(".roombuttons").hide();				
			break;
			case ("AutoPerformance"):
			  joinRoom();
				$(".roombuttons").show();
				$("#download").show();	
				$("#autoreport").show();
				$("#spinner").show();
				
				
				$(".dateinputs").hide();
				$("#report").hide();
				$("#mainreport12").hide();
				$("#mainreport3").hide();				
				$("#groupoption").hide();
			break;
      default:
			break;
      }			
	});
	
  socket.on('Report12Response', function(data) { // this returns an array of objects
    for (var i in data) {
      if (data[i].surveyScore == "") data[i].surveyScore = "0";
			if (data[i].resolved=="") data[i].resolved = "0";
    }
    $("#spinner").hide();
  	$("#mainreport12").tabulator("setData", data);
  });
	
  socket.on('Report3Response', function(data) { // this returns an array of objects
    $("#spinner").hide();
    $("#mainreport3").tabulator("setData", data);
  });
	
	socket.on('AutoReportResponse', function(data) { // this returns an array of objects
    $("#spinner").hide();
    $("#autoreport").tabulator("setData", data);
  });	
	
  //datepickers
	
  $("#bdate").datepicker({
    onClose: function() {
      $("#edate").datepicker(
        "change", {
          minDate: new Date($('#bdate').val())
        }
      );
    }
  });
  $("#edate").datepicker({
    onClose: function() {
      $("#bdate").datepicker(
        "change", {
          maxDate: new Date($('#edate').val())
        }
      );
    }
  });
	
  $("#bdate").datepicker("setDate", new Date()); // was "-1m";
  $("#edate").datepicker("setDate", new Date());
  /*
	$("#edate").datepicker("change", {
    minDate: new Date($("#bdate").val())
  });
  $("#bdate").datepicker("change", {
    maxDate: new Date($("#edate").val())
  });
	*/
  $("#hierarchy").tabulator({
    height: "50%", // set height of table
    fitColumns: true, //fit columns to width of table (optional)
    columns: [ //Define Table Columns
      {
        title: "ID",
        field: "nodeID",
        sorter: "number",
        align: "right",
        headerFilter: true,
        onClick: function(e, cell, val, data) {
          $("#nodeID").val(val);
					selectedEnv = val+"";
					selectedType = ((data.type == "Channel\n\n") ? "CHANNEL" : "NODE"); 
          $("#hierarchy").hide(1000);
        }
      },
      {
        title: "Name",
        field: "name",
        sorter: "string",
        align: "left",
        headerFilter: true
      },
      {
        title: "Group",
        field: "type",
        sorter: "string",
        align: "left",
        headerFilter: true
      }
    ],
  });
  $("#mainreport12").tabulator({
		height: Math.round($(window).height()*0.83),
    fitColumns: true, //fit columns to width of table (optional)
    //dateFormat: "dd/mm/yyyy",
    sortBy: 'Name', // when data is loaded into the table, sort it by name
    sortDir: 'asc',
    columns: [ //Define Table Columns
      {
        title: "Session",
        field: "sessionID",
        sorter: "number",
        align: "right",
        headerFilter: true
      },
      {
        title: "Type",
        field: "sessionType",
        sorter: "string",
        align: "left",
        headerFilter: true
      },
      {
        title: "Name",
        field: "name",
        sorter: "string",
        align: "left",
        headerFilter: true
      },
			/*
      {
        title: "Department",
        field: "department",
        sorter: "string",
        align: "left",
        headerFilter: true
      },*/
      {
        title: "Start",
        field: "start",
        sorter: "datetime",
        align: "left",
        headerFilter: true
      },
      {
        title: "End",
        field: "end",
        sorter: "datetime",
        align: "left",
        headerFilter: true
      },
      {
        title: "RC",
        field: "RC",
        sorter: "boolean",
        formatter: "tick",
        align: "left",
        headerFilter: true
      },
			{
        title: "Resolved",
        field: "resolved",
				sorter: "number",
        formatter: "star",
				formatterParams:{stars:3},
        align: "left"
      },
      {
        title: "Wait Time",
        field: "waitTime",
        sorter: "string",
        align: "left"
      },
      {
        title: "Total Time",
        field: "totalTime",
        sorter: "string",
        align: "left"
      },
      {
        title: "Active Time",
        field: "activeTime",
        sorter: "string",
        align: "left"
      },
      {
        title: "Work Time",
        field: "workTime",
        sorter: "string",
        align: "left"
      },
			/*
      {
        title: "Wrap Time",
        field: "wrapTime",
        sorter: "string",
        align: "left"
      },*/
      {
        title: "Score",
        field: "surveyScore",
        formatter: "star",
				sorter: "number",
        align: "left"
      },
      {
        title: "Comment",
        field: "surveyComment",
        formatter: "textarea",
        align: "left"
      }
    ],
  });
  $("#mainreport3").tabulator({
    height: Math.round($(window).height()*0.83), // set height of table (optional)
    fitColumns: true, //fit columns to width of table (optional)
    sortBy: 'noOfSessions', // when data is loaded into the table, sort it by name
    sortDir: 'desc',
    columns: [ //Define Table Columns
      {
        title: "Tech Name",
        field: "techName",
        sorter: "string",
        align: "left",
        headerFilter: true
      },
      {
        title: "Tech ID",
        field: "techID",
        sorter: "number",
        align: "right",
        headerFilter: true
      },
      {
        title: "Sessions",
        field: "noOfSessions",
        sorter: "number",
        align: "right",
        headerFilter: true
      },
      {
        title: "Total Login Time",
        field: "totalTime",
        sorter: "string",
        align: "left"
      },
      {
        title: "Average Pickup Time",
        field: "avgPickup",
        sorter: "string",
        align: "left"
      },
      {
        title: "Average Duration",
        field: "avgDuration",
        sorter: "string",
        align: "left"
      },
      {
        title: "Average Work Time",
        field: "avgWorkTime",
        sorter: "string",
        align: "left"
      },
      {
        title: "Total Active Time",
        field: "totalActiveTime",
        sorter: "string",
        align: "left"
      },
      {
        title: "Total Work Time",
        field: "totalWorkTime",
        sorter: "string",
        align: "left"
      }
    ],
  });
	  $("#autoreport").tabulator({
    height: Math.round($(window).height()*0.83), // set height of table (optional)
    fitColumns: true, //fit columns to width of table (optional)
    sortBy: 'noOfSessions', // when data is loaded into the table, sort it by name
    sortDir: 'desc',
    columns: [ //Define Table Columns
      {
        title: "Tech Name",
        field: "techName",
        sorter: "string",
        align: "left",
        headerFilter: true
      },
      {
        title: "Tech ID",
        field: "techID",
        sorter: "number",
        align: "right",
        headerFilter: true
      },
      {
        title: "Sessions",
        field: "noOfSessions",
        sorter: "number",
        align: "right",
        headerFilter: true
      },
      {
        title: "Total Login Time",
        field: "totalTime",
        sorter: "string",
        align: "left"
      },
      {
        title: "Average Pickup Time",
        field: "avgPickup",
        sorter: "string",
        align: "left"
      },
      {
        title: "Average Duration",
        field: "avgDuration",
        sorter: "string",
        align: "left"
      },
      {
        title: "Average Work Time",
        field: "avgWorkTime",
        sorter: "string",
        align: "left"
      },
      {
        title: "Total Active Time",
        field: "totalActiveTime",
        sorter: "string",
        align: "left"
      },
      {
        title: "Total Work Time",
        field: "totalWorkTime",
        sorter: "string",
        align: "left"
      }
    ],
  });
}); /** end document ready stuff **/