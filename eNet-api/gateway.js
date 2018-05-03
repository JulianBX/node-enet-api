"use strict";

//sudo nano /usr/local/lib/node_modules/homebridge-enet-dev/node_modules/node-enet-api/eNet-api/gateway.js


const CONNECTION_PORT = 9050;

const net = require('net');
const util = require('util');
const EventEmitter = require('events');

function gateway(config) {
    this.idleTimeout = 3000; //this == der aufrufende Prozess bekommt eine Variable namens idleTimeout mit dem Wert 3000
    
    /*
		Solution to maintain this inside anonymous functions:
To fix the problem with using this inside the anonymous function passed to the forEach method, we use a common practice in JavaScript and set the this value to another variable before we enter the forEach
method:

	 var theUserObj = this;
    this.data.forEach (function (person) {
    // Instead of using this.tournament, we now use theUserObj.tournament​
    console.log (person.name + " is playing at " + theUserObj.tournament);
    })
    
    
    
     $("button").click (user.clickHandler.bind (user)); // P. Mickelson 43

	*/
    this.host = config.host;
    this.name = config.name || config.host;
    this.id = config.mac || config.name;
    this.keepAlwaysAlive = config.keepAlwaysAlive || false;
    this.accessories = [];
    this.accListening = [];

    this.client = new net.Socket();
    this.connected = false;
    this.data = '';

    this.client.on('close', function() {
        this.connected = false;
        this.emit('gateway', null, null);
        console.log('gateway close');
    }.bind(this));

    this.client.on('error', function (err) {
        this.connected = false;
        this.emit('gateway', err, null);
        console.log('gateway error');
    }.bind(this));

/*/HIER ENTSTEHT EINE WEITERE VERBESSERUNG  ###################################################
    this.client.on('itemUpdate', function (updateArray) {
	 console.log("Updating channel: Damn shit" + JSON.stringify(updateArray));
//        console.log('Updating channel: ' + channel + " to value: " + value + " and state: " + state);
	updateArray.forEach(function(obj){

	    console.log("Objekt seems to be: " + JSON.stringify(obj));
	    console.log("Accesories?: " + this.accessories);
	    for(var i = 0; i < this.accessories.length-1; ++i) {
                    console.log("Accesories-Name?: " + JSON.parse(JSON.stringify(this.accessories[i])));
		    this.emit('UpdateAvailable',obj);

/*		    if (this.accessories[i].context.channel == obj.NUMBER) {
	    		this.accessories[i].context.receivedBrightness = obj.VALUE;
	    		this.accessories[i].context.receivedState = obj.STATE;
			console.log("Vorher" + JSON.stringify(this.accessories[i].service));
			this.accessories[i].service.getCharacteristic(Characteristic.On).updateValue(obj.STATE);
			console.log("Nachher");

//			this.accessories[i].getService(Service.Lightbulb).getCharacteristic(Characteristic.On).updateValue(obj.STATE);
//			this.accessories[i].getService(Service.Lightbulb).getCharacteristic(Characteristic.Brightness).updateValue(obj.VALUE);
    //        	    }
	    }
	}.bind(this));
    }.bind(this));
*/



//   AB HIER funktioniert es !!!
    this.client.on('data', function(data) {
        this.data += data;
        var arr = this.data.split("\r\n\r\n");
        this.data = arr[arr.length-1];


//Was möchte ich erreichen? -> this.accesories[].emit("Update",Value);
        for (var i = 0; i < arr.length-1; ++i) {
            try{
                var json=JSON.parse(arr[i]);
				console.log("Data comes: "+JSON.stringify(json) + " seltsam...0815??");
                // Check for channel messages
                if (json && (json.CMD == "ITEM_UPDATE_IND") && Array.isArray(json.VALUES)) {
					//Es ist ein Update und ich habe json.VALUES 
					//json.VALUES : {"NUMBER":"16","VALUE":"0","STATE":"OFF","SETPOINT":"255"}
					var acknowledgeMsg = [];
					for (var i = 0; i < json.VALUES.length; i++) {
						var jsonItem = json.VALUES[i];
                        			console.log("Doing" + Number(jsonItem.NUMBER));	
						var channel = Number(jsonItem.NUMBER) - 16;
						console.log("Channel" + channel);
						if (channel >= 0) {
							this.emit('UpdateAvailableForChannel',channel,jsonItem);
							console.log("Emitted on channel: " + channel);
						}
						if (jsonItem.NUMBER){
							acknowledgeMsg.push({"NUMBER":jsonItem.NUMBER.toString(),"STATE":jsonItem.STATE.toString()});
                        }

                	}
                  	if (acknowledgeMsg != []){
						//{"CMD":"ITEM_VALUE_RES","PROTOCOL":"0.03","TIMESTAMP":"1513688129","VALUES":[{"NUMBER":16,"STATE":"OFF"},{"NUMBER":17,"STATE":"OFF"}]}
                        var msg = `{"CMD":"ITEM_VALUE_RES","PROTOCOL":"0.03","TIMESTAMP":"${Math.floor(Date.now()/1000)}","VALUES":${JSON.stringify(acknowledgeMsg)}\r\n\r\n`;
						console.log("MSG: " + msg);
			    		this.client.write(msg);
                    }
		    		//this.emit('UpdateAvailable',json.VALUES);
                }
                else {
                    this.emit('gateway', null, json);
                }
            }catch(e){
                this.emit('gateway', e, null);
            }
        }
    }.bind(this));
}// //ENDE VOM FUNKTIONIERENDEN TEIL!!



// ACK=====  {"CMD":"ITEM_VALUE_RES","PROTOCOL":"0.03","TIMESTAMP":"1525199753","VALUES":[{"NUMBER":16,"STATE":"OFF"},{"NUMBER":17,"STATE":"OFF"}]}

/*
   this.client.on('data', function(data) {
        this.data += data;
        var arr = this.data.split("\r\n\r\n");

        this.data = arr[arr.length-1];

        for (var i = 0; i < arr.length-1; ++i) {
            try{
                var json=JSON.parse(arr[i]);

                // Check for channel messages
                // {"PROTOCOL":"0.03","TIMESTAMP":"11154711","CMD":"ITEM_UPDATE_IND","VALUES":[{"NUMBER":"16","VALUE":"1","STATE":"ON$
                if (json && (json.CMD == "ITEM_UPDATE_IND") && Array.isArray(json.VALUES)) {
                    json.VALUES.forEach(function(obj) {
                        if (obj.NUMBER){
                            this.emit(obj.NUMBER.toString(), null, obj);
                        }
                    }.bind(this));
                }
                else {
                    this.emit('gateway', null, json);
                }
            }catch(e){
                this.emit('gateway', e, null);
            }
        }
    }.bind(this));
}*/


util.inherits(gateway, EventEmitter);


module.exports = function (config) {
    return new gateway(config);
}

gateway.prototype.connect = function(keepAlive) {
    if (this.connected) return;
    if (!this.host) return;
    this.connected = true;

    this.client.connect(CONNECTION_PORT, this.host, function() {
            if(!keepAlive && !this.keepAlwaysAlive) {
		    this.client.setTimeout(this.idleTimeout, function() {
	                this.disconnect();
	            }.bind(this))
	    }
        }.bind(this));
}

gateway.prototype.disconnect = function() {
    this.client.end();
    this.connected = false;
}

gateway.prototype.send = function(data) {
    this.client.write(data);
}

gateway.prototype.updateAccessories = function (accessories) {
	this.accessories = accessories;
}



////////////////////////////////////////////////////////////////////////////////
//
//  Gateway commands
//

gateway.prototype.getVersion = function(callback){
    var l;

    if (callback) l = new responseListener(this, "VERSION_RES", callback);

    if (!this.connected) this.connect();

    var msg = `{"CMD":"VERSION_REQ","PROTOCOL":"0.03","TIMESTAMP":"${Math.floor(Date.now()/1000)}"}\r\n\r\n`;
    this.client.write(msg);

// response: {"PROTOCOL":"0.03","TIMESTAMP":"18154711","CMD":"VERSION_RES","FIRMWARE":"0.91","HARDWARE":"73355700","ENET":"45068305","PROTOCOL":"0.03"}
}

gateway.prototype.getBlockList = function(callback){
    var l;

    if (callback) l = new responseListener(this, "BLOCK_LIST_RES", callback);

    if (!this.connected) this.connect();

    var msg = `{"CMD":"BLOCK_LIST_REQ","PROTOCOL":"0.03","TIMESTAMP":"${Math.floor(Date.now()/1000)}","LIST-RANGE":1}\r\n\r\n`;
    this.client.write(msg);

// response: {"PROTOCOL":"0.03","TIMESTAMP":"18154711","CMD":"BLOCK_LIST_RES","STATE":0,"LIST-RANGE":1,"LIST-SIZE":[36,227,76,35,51,313,97,13,0,0],"DATA-IDS":[1,6,1,1,1,10,1,1,0,0]}
}

gateway.prototype.getChannelInfo = function(callback){
    var l;

    if (callback) l = new responseListener(this, "GET_CHANNEL_INFO_ALL_RES", callback);

    if (!this.connected) this.connect();

    var msg = `{"CMD":"GET_CHANNEL_INFO_ALL_REQ","PROTOCOL":"0.03","TIMESTAMP":"${Math.floor(Date.now()/1000)}"}\r\n\r\n`;
    this.client.write(msg);

// response: {"PROTOCOL":"0.03","TIMESTAMP":"18154711","CMD":"GET_CHANNEL_INFO_ALL_RES","DEVICES":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}
}

gateway.prototype.getProjectList = function(callback){
    var l;

    if (callback) l = new responseListener(this, "PROJECT_LIST_RES", callback);

    if (!this.connected) this.connect();

    var msg = `{"CMD":"PROJECT_LIST_GET","PROTOCOL":"0.03","TIMESTAMP":"${Math.floor(Date.now()/1000)}"}\r\n\r\n`;
    this.client.write(msg);
}

////////////////////////////////////////////////////////////////////////////////
//
//  Channel commands
//

gateway.prototype.signOut = function(channels, callback){
    var l;

    if (!Array.isArray(channels))
    {
        callback && callback(new Error('signOut needs a channels array.'));
        return;
    }

    if (callback) l = new responseListener(this, "ITEM_VALUE_SIGN_OUT_RES", callback);

    if (!this.connected) this.connect();

    var msg = `{"ITEMS":${JSON.stringify(channels)},"CMD":"ITEM_VALUE_SIGN_OUT_REQ","PROTOCOL":"0.03","TIMESTAMP":"${Math.floor(Date.now()/1000)}"}\r\n\r\n`;
    this.client.write(msg);

// response: {"PROTOCOL":"0.03","TIMESTAMP":"18154711","CMD":"ITEM_VALUE_SIGN_OUT_RES"}
}

gateway.prototype.signIn = function(channels, callback){
    var l;

    if (!Array.isArray(channels))
    {
        if (callback) callback(new Error('signIn needs a channels array.'));
        return;
    }
    console.log("signInDEVMODE");
    if (callback) l = new responseListener(this, "ITEM_VALUE_SIGN_IN_RES", callback);

    if (!this.connected) this.connect();

    var msg = `{"ITEMS":${JSON.stringify(channels)},"CMD":"ITEM_VALUE_SIGN_IN_REQ","PROTOCOL":"0.03","TIMESTAMP":"${Math.floor(Date.now()/1000)}"}\r\n\r\n`;
    this.client.write(msg);

// response: {"PROTOCOL":"0.03","TIMESTAMP":"18154711","CMD":"ITEM_VALUE_SIGN_IN_RES","ITEMS":[16]}
}

gateway.prototype.setValue = function(channel, on, long, callback){
    var l;

    if (callback) l = new channelResponseListener(this, channel, "ITEM_VALUE_RES", callback);

    if (!this.connected) this.connect();

    var msg = `{"CMD":"ITEM_VALUE_SET","PROTOCOL":"0.03","TIMESTAMP":"${Math.floor(Date.now()/1000)}","VALUES":[{"STATE":"${on ? "ON":"OFF"}"${long ? ",\"LONG_CLICK\":\"ON\"" : ""},"NUMBER":${channel}}]}\r\n\r\n`;
//    var msg = `{"CMD":"ITEM_VALUE_SET","PROTOCOL":"0.03","TIMESTAMP":"${Math.floor(Date.now()/1000)}","VALUES":[{"STATE":"${on ? "ON":"OFF"}","LONG_CLICK":"${long ? "ON":"OFF"}","NUMBER":${channel}}]}\r\n\r\n`;

    this.client.write(msg);

// response: {"CMD":"ITEM_VALUE_RES","PROTOCOL":"0.03","TIMESTAMP":"1467998383","VALUES":[{"NUMBER":16,"STATE":"OFF"}]}
}

gateway.prototype.setValueDim = function(channel, dimVal, callback){
    var l;

    if (callback) l = new channelResponseListener(this, channel, "ITEM_VALUE_RES", callback);

    if (!this.connected) this.connect();

    var msg = `{"CMD":"ITEM_VALUE_SET","PROTOCOL":"0.03","TIMESTAMP":"${Math.floor(Date.now()/1000)}","VALUES":[{"STATE":"VALUE_DIMM","VALUE":${dimVal},"NUMBER":${channel}}]}\r\n\r\n`;

    this.client.write(msg);
}


gateway.prototype.setValueBlind = function(channel, blindVal, callback){
    var l;

    if (callback) l = new channelResponseListener(this, channel, "ITEM_VALUE_RES", callback);

    if (!this.connected) this.connect();

    var msg = `{"CMD":"ITEM_VALUE_SET","PROTOCOL":"0.03","TIMESTAMP":"${Math.floor(Date.now()/1000)}","VALUES":[{"STATE":"VALUE_BLINDS","VALUE":${blindVal},"NUMBER":${channel}}]}\r\n\r\n`;

    this.client.write(msg);
}


function responseListener(gateway, response, callback) {
    this.gateway = gateway;

    this.cb = function(err, msg) {
        if (err)
        {
            gateway.removeListener('gateway', this.cb);
            callback(err);
        }
        else {
            if (!msg) {
                gateway.removeListener('gateway', this.cb);
                callback(new Error("Gateway disconnected."));
                return;
            }

            if (msg.CMD === response){
                gateway.removeListener('gateway', this.cb);
                callback(null, msg);
            }
        }
    }.bind(this);

    gateway.on('gateway', this.cb);
}

function channelResponseListener(gateway, channel, response, callback) {
    this.gateway = gateway;
    this.listening = true;

    this.cb = function(err, msg) {
        if (err)
        {
            gateway.removeListener('gateway', this.cb);
            callback(err);
        }
        else {
            if (!msg) {
                gateway.removeListener('gateway', this.cb);
                callback(new Error("Gateway disconnected."));
                return;
            }
            if ((msg.CMD === response) && Array.isArray(msg.VALUES)) {
                msg.VALUES.forEach(function(obj) {
                    if (obj.NUMBER === channel.toString()){
                        gateway.removeListener('gateway', this.cb);
                        callback(null, obj);
                    }
                }.bind(this));
            }
        }
    }.bind(this);

    gateway.on('gateway', this.cb);
}
