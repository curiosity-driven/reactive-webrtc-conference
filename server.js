var crypto = require('crypto');
var express = require('express');

var WebSocketServer = require('ws').Server;
var app = express();

var server;

if (option('secure')) {
    var fs = require('fs');
    var credentials = {
        key: fs.readFileSync('cert/server.key', 'utf8'),
        cert: fs.readFileSync('cert/server.crt', 'utf8')
    };
    server = require('https').createServer(credentials, app);
} else {
    server = require('http').createServer(app);
}

app.use(express.static(__dirname + '/public'));

function sendToOneClient(clientId, client) {
    return client.id === clientId;
}

function sendToOthers(ownConnection, client) {
    return ownConnection.upgradeReq.url === client.upgradeReq.url &&
        client !== ownConnection;
}

function parseJSON(data) {
    try {
        return JSON.parse(data);
    } catch (e) {
        console.warn('Cannot parse JSON', e);
    }
}

function option(name) {
    var env = process.env;
    return env['npm_config_' + name] || env[name.toUpperCase()] || env['npm_package_config_' + name];
}

var configuration = {
    server: server
};

if (option('origin')) {
    configuration.verifyClient = function(info) {
        return info.origin === option('origin');
    };
} else {
    console.warn('Verifying client connections disabled!')
}

var ws = new WebSocketServer(configuration);

ws.on('connection', function(connection) {
    connection.id = crypto.randomBytes(20).toString('hex');
    ws.clients.filter(sendToOthers.bind(null, connection)).forEach(function(client) {
        client.send(JSON.stringify({
            from: connection.id,
            body: {
                type: 'join'
            }
        }));
    });
    connection.on('message', function(data) {
        var message = parseJSON(data);
        if (!message) return;
        var target = message.to ? sendToOneClient.bind(null, message.to) : sendToOthers.bind(null, connection);
        ws.clients.filter(target).forEach(function(client) {
            client.send(JSON.stringify({
                from: connection.id,
                body: message.body
            }));
        });
        console.log('received:', message);
    });
});

server.listen(option('port'));

console.info('Open: http' + (option('secure') ? 's' : '') + '://localhost:' + option('port'));
