const http = require('http');
const serveur = http.createServer(function(requete, reponse) {});

const port = 1234;

serveur.listen(port, function() {
    console.log((new Date()) + " Le serveur écoute le port " + port + ".");
});

const ServeurWebSocket = require('websocket').server;
const serveurWS = new ServeurWebSocket ({
    httpServer: serveur
});

var total = 0;
var clients = {};

serveurWS.on('request', function(r){
    var connexion = r.accept('echo-protocol', r.origin);
    let id = total++;
    // Store the connection method so we can loop through & contact all clients
    clients[id] = connexion;
    console.log((new Date()) + " Connexion acceptée [" + id + "]");

    // Create event listener
    connexion.on('message', function(message) {
	var msg = JSON.parse(message.utf8Data);
	var date = new Date(msg.date);
	var dateAffichable = date.toLocaleTimeString();
  
	switch(msg.type) {
	case "message":
	    // The string message that was sent to us
	    var mot = msg.contenu;
	    console.log(mot);
	    // Loop through all clients
	    for(var i in clients){
		// Send a message to the client with the message
		
		if(i == id){
		    
		}else{
		    console.log("Diffusion de " + id + " vers " + i + " du message " + mot + " envoyé à " + dateAffichable);
		    clients[i].sendUTF(mot);
		}
	    }
	    break;
	};
	
    });

    connexion.on('close', function(reasonCode, description) {
	delete clients[id];
	console.log((new Date()) + " Client " + id + " à l'adresse " + connexion.remoteAddress + " déconnecté.");
    });
});
