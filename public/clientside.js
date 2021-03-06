var name;
var connectedUser;

navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition
  || window.msSpeechRecognition || window.oSpeechRecognition;

var conn = new WebSocket("wss://localhost:443");

var constraints = {
  audio: true,
  video: true
};

conn.onopen = function () {
   console.log("Connected to server");
};

conn.onmessage = function (msg) {
   console.log("Got message", msg.data);

   var data = JSON.parse(msg.data);

   switch(data.type) {
      case "login":
         handleLogin(data.success);
         break;
      case "offer":
         handleOffer(data.offer, data.name);
         break;
      case "answer":
         handleAnswer(data.answer);
         break;
      case "candidate":
         handleCandidate(data.candidate);
         break;
      case "leave":
         handleLeave();
         break;
      default:
         break;
   }
};

conn.onerror = function (err) {
   console.log("Got error", err);
};

function send(message) {

   if (connectedUser) {
      message.name = connectedUser;
   }

      console.log("send", message);
   conn.send(JSON.stringify(message));
};

var loginPage = document.querySelector("#loginPage");
var usernameInput = document.querySelector("#usernameInput");
var loginBtn = document.querySelector("#loginBtn");

var callPage = document.querySelector("#callPage");
var callToUsernameInput = document.querySelector("#callToUsernameInput");
var callBtn = document.querySelector("#callBtn");

var hangUpBtn = document.querySelector("#hangUpBtn");

var localVideo = document.querySelector("#localVideo");
var remoteVideo = document.querySelector("#remoteVideo");

var msgInput = document.querySelector('#msgInput');
var sendMsgBtn = document.querySelector('#sendMsgBtn');

var chatArea = document.querySelector('#chatarea');

var dataChannel;
var connection;
var stream;

usernameInput.addEventListener('keyup', function(e){

  console.log("login", "clicked");
  if (e.keyCode == 13) {
         name = usernameInput.value;

         console.log("login", "clicked");
         if (name.length > 0) {

            console.log("login", "clicked");
            send({
               type: "login",
               name: name
            });
         }
  }
});


loginBtn.addEventListener("click", function (event) {
   name = usernameInput.value;

   console.log("login", "clicked");
   if (name.length > 0) {

      console.log("login", "clicked");
      send({
         type: "login",
         name: name
      });
   }

});

function handleLogin(success) {
   if (success === false) {
      alert("The username already choosed.try another username");
   } else {
      loginPage.style.display = "none";
      callPage.style.display = "block";

      navigator.getUserMedia(constraints, function (myStream) {
         stream = myStream;

         localVideo.src = window.URL.createObjectURL(stream);

         var configuration = {
            "iceServers": [{ "url": "stun:stun2.1.google.com:19302" },{
	url: 'turn:numb.viagenie.ca',
	credential: 'muazkh',
	username: 'webrtc@live.com'
},
{
	url: 'turn:192.158.29.39:3478?transport=udp',
	credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
	username: '28224511:1379330808'
},
{
	url: 'turn:192.158.29.39:3478?transport=tcp',
	credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
	username: '28224511:1379330808'
}
          ]
         };

         connection = new RTCPeerConnection(configuration);

         dataChannel = connection.createDataChannel("channel1", {negotiated: true, id: 0});

         dataChannel.onerror = function (error) {
            console.log("Ooops...error:", error);
         };

         dataChannel.onmessage = function (event) {
            console.log("data channel message " + event.data);

            chatArea.innerHTML += "<div class='remotemsg'>"+"<span>"+connectedUser +"</span>"+ ": " + event.data + "</div>";
            $('#chatarea').scrollTop($('#chatarea')[0].scrollHeight);

         };

         dataChannel.onclose = function () {
            console.log("data channel is closed");
         };

         dataChannel.onopen = function () {
            console.log("data channel is open");
         };

         connection.addStream(stream);

         connection.onaddstream = function (e) {
            remoteVideo.src = window.URL.createObjectURL(e.stream);
         };

         connection.onicecandidate = function (event) {
            if (event.candidate) {
               send({
                  type: "candidate",
                  candidate: event.candidate
               });
            }
         };

      }, function (error) {
         console.log(error);
      });
   }
};

callBtn.addEventListener("click", function () {
   var callToUsername = callToUsernameInput.value;

   if (callToUsername.length > 0) {

      connectedUser = callToUsername;

      connection.createOffer(function (offer) {
         send({
            type: "offer",
            offer: offer
         });

         connection.setLocalDescription(offer);
      }, function (error) {
         alert("Error when creating an offer");
      });

   }
});

function handleOffer(offer, name) {
   connectedUser = name;
   connection.setRemoteDescription(new RTCSessionDescription(offer));

   connection.createAnswer(function (answer) {
      connection.setLocalDescription(answer);

      send({
         type: "answer",
         answer: answer
      });

   }, function (error) {
      alert("Error when creating an answer");
   });
};

function handleAnswer(answer) {
   connection.setRemoteDescription(new RTCSessionDescription(answer));
};

function handleCandidate(candidate) {
   connection.addIceCandidate(new RTCIceCandidate(candidate));
};

hangUpBtn.addEventListener("click", function () {

   send({
      type: "leave"
   });

   handleLeave();
});

msgInput.addEventListener('keyup', function(e){

  if (e.keyCode == 13) {
    sendMessageForPeer();
  }

});

sendMsgBtn.addEventListener("click", function (event) {
  sendMessageForPeer();
});

function sendMessageForPeer() {

    switch(dataChannel.readyState) {
        case "connecting":
          console.log("Connection not open;  ");
          break;
        case "open":

           var val = msgInput.value;
           chatArea.innerHTML += "<div class='localmsg'>"+"<span>"+name +"</span>" +": " + val + "</div>";
           $('#chatarea').scrollTop($('#chatarea')[0].scrollHeight);
           dataChannel.send(val);
           msgInput.value = "";

          break;
        case "closing":
          console.log("Attempted to send message while closing: " );
          break;
        case "closed":
          console.log("Error! Attempt to send while connection closed.");
          break;
      }
};

function handleLeave() {
   connectedUser = null;
   remoteVideo.src = null;

   connection.close();
   connection.onicecandidate = null;
   connection.onaddstream = null;
};
