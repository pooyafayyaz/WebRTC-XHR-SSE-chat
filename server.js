const WebSocketServer = require('ws').Server,
  express = require('express'),
  https = require('https'),
  app = express(),
  fs = require('fs');
  sse = require('./sse');
var bodyParser = require('body-parser');

var users = {};
var sseConnections = {};

const pkey = fs.readFileSync('./ssl/key.pem'),
  pcert = fs.readFileSync('./ssl/cert.pem'),
  options = {key: pkey, cert: pcert, passphrase: '123456789'};
var wss = null, sslSrv = null;

// use express static to deliver resources HTML, CSS, JS, etc)
// from the public folder
app.use(express.static('public'));
app.use(sse);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(function(req, res, next) {
  if(req.headers['x-forwarded-proto']==='http') {
    return res.redirect(['https://', req.get('Host'), req.url].join(''));
  }
  next();
});

app.get('/', function(req, res) {

  console.log("dddd");
    res.sendFile(path.join(__dirname + '/intro.html'));

});

app.all('/stream', function(req, res){
    // res.sseSetup();
    console.log("SSE saved for: ", req.query.name);

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });

    sseConnections[req.query.name] = res;
    res.write("data: " +"status: 200" + "\n\n");

});

function sendToSSE(sseConn, message) {
  res = sseConnections[sseConn];

  console.log("want to send to ", sseConn);

  if (sseConnections[sseConn]) {

    res.write("data: " + JSON.stringify(message) + "\n\n");
    console.log("SSE send: ", sseConn);

  }
  // sseConnections[sseConn].sseSend(message);
}

app.all('/api/v1/xhr', function(req, res) {
  var data;

  try {
     data = JSON.parse(JSON.stringify(req.body));
  } catch (e) {
     console.log("Invalid JSON");
     data = {};
  }

  switch (data.type) {
     //when a user tries to login
     case "login":
        console.log("User logged", data.name);

        //if anyone is logged in with this username then refuse
        // if(sseConnections[data.name]) {
        //    sendToSSE(data.name, {
        //       type: "login",
        //       success: false
        //    });
        // } else {
           //save user connection on the server
           res.name = data.name;

           sendToSSE(data.name, {
              type: "login",
              success: true
           });
        // }

        break;

     case "offer":
        //for ex. UserA wants to call UserB
        console.log("Sending offer to: ", data.name);
        console.log("Sending offer from: ", data.username);

        //if UserB exists then send him offer details
        var conn = sseConnections[data.name];

        if(conn != null) {
           //setting that UserA connected with UserB
           res.otherName = data.name;

           sendToSSE(data.name, {
              type: "offer",
              offer: data.offer,
              name: data.username
           });
        }

        break;

     case "answer":
        console.log("Sending answer to: ", data.name);
        //for ex. UserB answers UserA
        var conn = sseConnections[data.name];

        if(conn != null) {
           res.otherName = data.name;
           sendToSSE(data.name, {
              type: "answer",
              answer: data.answer
           });
        }

        break;

     case "candidate":
        console.log("Sending candidate to:",data.name);
        var conn = sseConnections[data.name];

        if(conn != null) {
           sendToSSE(data.name, {
              type: "candidate",
              candidate: data.candidate
           });
        }

        break;

     case "leave":
        console.log("Disconnecting from", data.name);
        var conn = sseConnections[data.name];
        conn.otherName = null;

        //notify the other user so he can disconnect his peer connection
        if(conn != null) {
           sendToSSE(data.name, {
              type: "leave"
          });
        }

        break;

     default:
        // sendToSSE(connection, {
        //    type: "error",
        //    message: "Command not found: " + data.type
        // });

        break;
  }

  res.sendStatus(200)

});

// start server (listen on port 443 - SSL)
sslSrv = https.createServer(options, app).listen(443);
console.log("The HTTPS server is up and running");

// create the WebSocket server
wss = new WebSocketServer({server: sslSrv});
console.log("WebSocket Secure server is up and running.");


//when a user connects to our sever
wss.on('connection', function(connection) {

   console.log("User connected");

   //when server gets a message from a connected user
   connection.on('message', function(message) {

      var data;

      //accepting only JSON messages
      try {
         data = JSON.parse(message);
      } catch (e) {
         console.log("Invalid JSON");
         data = {};
      }

      //switching type of the user message
      switch (data.type) {
         //when a user tries to login
         case "login":
            console.log("User logged", data.name);

            //if anyone is logged in with this username then refuse
            if(users[data.name]) {
               sendTo(connection, {
                  type: "login",
                  success: false
               });
            } else {
               //save user connection on the server
               users[data.name] = connection;
               connection.name = data.name;

               sendTo(connection, {
                  type: "login",
                  success: true
               });
            }

            break;

         case "offer":
            //for ex. UserA wants to call UserB
            console.log("Sending offer to: ", data.name);

            //if UserB exists then send him offer details
            var conn = users[data.name];

            if(conn != null) {
               //setting that UserA connected with UserB
               connection.otherName = data.name;

               sendTo(conn, {
                  type: "offer",
                  offer: data.offer,
                  name: connection.name
               });
            }

            break;

         case "answer":
            console.log("Sending answer to: ", data.name);
            //for ex. UserB answers UserA
            var conn = users[data.name];

            if(conn != null) {
               connection.otherName = data.name;
               sendTo(conn, {
                  type: "answer",
                  answer: data.answer
               });
            }

            break;

         case "candidate":
            console.log("Sending candidate to:",data.name);
            var conn = users[data.name];

            if(conn != null) {
               sendTo(conn, {
                  type: "candidate",
                  candidate: data.candidate
               });
            }

            break;

         case "leave":
            console.log("Disconnecting from", data.name);
            var conn = users[data.name];
            conn.otherName = null;

            //notify the other user so he can disconnect his peer connection
            if(conn != null) {
               sendTo(conn, {
                  type: "leave"
              });
            }

            break;

         default:
            sendTo(connection, {
               type: "error",
               message: "Command not found: " + data.type
            });

            break;
      }

   });

   //when user exits, for example closes a browser window
   //this may help if we are still in "offer","answer" or "candidate" state
   connection.on("close", function() {

      if(connection.name) {
         delete users[connection.name];

         if(connection.otherName) {
            console.log("Disconnecting from ", connection.otherName);
            var conn = users[connection.otherName];
            conn.otherName = null;

            if(conn != null) {
               sendTo(conn, {
                  type: "leave"
               });
            }
         }
      }

   });
});

function sendTo(connection, message) {
   connection.send(JSON.stringify(message));
}
