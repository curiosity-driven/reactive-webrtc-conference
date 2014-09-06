/**
 * Copyright 2015 Curiosity driven
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *  https://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

function WebSocketSignalingChannel(address) {
    this.socket = new WebSocket(address);
    var socketObservable = Observable.fromWebSocket(this.socket);
    this.messages = socketObservable.map(function(event) {
        return JSON.parse(event.data);
    });
}

WebSocketSignalingChannel.prototype.next = function(object) {
    this.socket.send(JSON.stringify(object));
};

function getRoom() {
    var room = location.search.substring(1);
    if (room.length < 20) {
        room = crypto.getRandomValues(new Uint8Array(10)).map(function(b) {
            return b.toString(16);
        }).map(function pad(b) {
            return ('00' + b).slice(-2);
        }).join('');
        history.replaceState(null, '', '?' + room + '#conference');
    }
    return room;
}

function getSignalingChannel(room) {
    var url = location.protocol.replace('http', 'ws') + '//' + location.host + '/rooms/' + room;
    return new WebSocketSignalingChannel(url);
}

RTCPeer.prototype.handleMessage = function(body) {
    var peer = this.peer, type = body.type;

    if (type === 'join') {
        // peer 1
        return peer.createOffer().then(this.setLocal);
    } else if (type === 'offer') {
        // peer 2
        peer.setRemoteDescription(new RTCSessionDescription(body));
        return peer.createAnswer().then(this.setLocal);
    } else if (type === 'answer') {
        // peer 1
        peer.setRemoteDescription(new RTCSessionDescription(body));
    } else if (type === 'candidate') {
        // both peers
        peer.addIceCandidate(new RTCIceCandidate(body));
    }

    return Promise.resolve({ target: self });
};

function getReplies(messages, peers) {
    return messages.map(function(message) {
        return peers.get(message.from).handleMessage(message.body);
    }).unwrapPromises().filter(function(reply) {
        return reply.response;
    }).map(function(reply) {
        return {
            to: reply.target.id,
            body: reply.response
        };
    });
}

function RTCPeer(id, peer) {
    this.id = id;
    this.peer = peer;

    var iceEvents = Observable.fromEvent(peer, 'icecandidate');
    this.iceCandidates = iceEvents.filter(function(event) {
        return event.candidate;
    }).map(function(event) {
        return {
            target: this,
            candidate: event.candidate
        };
    }, this);

    var addStreamEvents = Observable.fromEvent(peer, 'addstream');
    this.streams = addStreamEvents.map(function(event) {
        return {
            target: this,
            stream: event.stream
        };
    }, this);

    this.setLocal = this.setLocal.bind(this);
}

RTCPeer.prototype.setLocal = function(description) {
    return this.peer.setLocalDescription(description).then(function() {
        return { target: this, response: description };
    }.bind(this));
};

function getCandidates(objects) {
    return objects.mergeMap(function(peer) {
        return peer.iceCandidates;
    }).map(function(event) {
        var candidate = JSON.parse(JSON.stringify(event.candidate));
        candidate.type = 'candidate';
        return {
            to: event.target.id,
            body: candidate
        };
    });
}

function getRemoteStreams(objects) {
    return objects.mergeMap(function(peer) {
        return peer.streams;
    }).map(function(event) {
        return event.stream;
    });
}

function LazyMap(create) {
    var map = new Map, generators = [];
    this.get = function(key) {
        if (map.has(key)) {
            return map.get(key);
        }
        var value = create(key);
        map.set(key, value);
        generators.forEach(function(generator) {
            generator.next(value);
        });
        return value;
    };
    this.objects = new Observable(function observe(generator) {
        generators.push(generator)
        return generator;
    });
}

function createMap(stream) {
    var configuration = {
        iceServers: [{
            url: 'stun:stun.l.google.com:19302'
        }, {
            url: 'stun:stun.services.mozilla.com'
        }, {
            url: 'turn:turn.bistri.com:80',
            credential: 'homeo',
            username: 'homeo'
        }]
    };
    return new LazyMap(function(id) {
        var peer = new RTCPeerConnection(configuration);
        peer.addStream(stream);
        return new RTCPeer(id, peer);
    });
}

function UI(container) {
    var bigRemoteView = container.querySelector('.remote');
    var selfView = container.querySelector('.self');
    var statusLabel = container.querySelector('.status');
    var substatusLabel = container.querySelector('.substatus');
    var participants = container.querySelector('.participants');

    function setParticipantsView() {
        var videos = participants.querySelectorAll('video:not(.self)');
        Array.from(videos).forEach(function(video) {
            video.hidden = video.src === bigRemoteView.src;
        });
    }

    function setBigSource() {
        bigRemoteView.src = this.src;
        setParticipantsView();
    }

    function addRemoteStream(stream) {
        var remoteView = document.createElement('video');
        participants.insertBefore(remoteView, participants.firstChild);

        remoteView.addEventListener('click', setBigSource);
        remoteView.autoplay = true;
        remoteView.src = URL.createObjectURL(stream);

        if (!bigRemoteView.src) {
            setBigSource.call(remoteView);
        }
    }

    var qrCode = new QRCode(substatusLabel.querySelector('.qr-link'), {
        width: 128,
        height: 128
    });

    return {
        updateStatus: function(message) {
            statusLabel.textContent = message;
        },
        showConnectionLink: function(link) {
            substatusLabel.querySelector('.link').textContent = link;
            qrCode.clear();
            qrCode.makeCode(link);
            var hidden = Array.from(substatusLabel.querySelectorAll('[hidden]'));
            hidden.forEach(function(element) {
                element.hidden = false;
            });
        },
        hideConnectionLink: function() {
            substatusLabel.querySelector('.center').hidden = true;
        },
        addRemoteStream: addRemoteStream,
        setLocalStream: function(stream) {
            selfView.src = URL.createObjectURL(stream);
        }
    };
}

function withUI(ui) {
    return {
        addLocalStream: function(stream) {
            ui.setLocalStream(stream);
            ui.updateStatus('waiting for someone to connect...');
            ui.showConnectionLink(location.href);
        },
        updateStatus: function(message) {
            if (message.body.type === 'join') {
                ui.updateStatus('calling...');
            } else if (message.body.type === 'offer') {
                ui.updateStatus('incoming call...');
            }
        },
        addRemoteStream: function (stream) {
            ui.updateStatus('');
            ui.hideConnectionLink();
            ui.addRemoteStream(stream);
        }
    };
}

var form = document.querySelector('form');
form.addEventListener('submit', function(e) {
    e.preventDefault();
    form.hidden = true;

    var source = Array.from(form.source).find(function(source) {
        return source.checked;
    });

    var constraints;

    if (source.dataset.source) {
        constraints = Promise.resolve(JSON.parse(source.dataset.source));
    } else {
        constraints = window[source.value]();
    }

    var mediaDevices = navigator.mediaDevices;
    var getUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);

    constraints.then(getUserMedia).then(connect);
});

function connect(stream) {
    var peers = createMap(stream);

    var signalingChannel = getSignalingChannel(getRoom());

    // pass events to UI object
    var ui = withUI(UI(document));
    ui.addLocalStream(stream);
    signalingChannel.messages.forEach(ui.updateStatus);
    getRemoteStreams(peers.objects).forEach(ui.addRemoteStream);

    // get responses
    var candidates = getCandidates(peers.objects);
    var replies = getReplies(signalingChannel.messages, peers);

    candidates.merge(replies).observe(signalingChannel);
}

function sourceChromeScreen() {
    var constraints = {
        audio: false,
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                maxWidth: screen.width > 1920 ? screen.width : 1920,
                maxHeight: screen.height > 1080 ? screen.height : 1080
            },
            optional: []
        }
    };
    var id = Math.random();
    return new Promise(function(resolve, reject) {
        window.addEventListener('message', function getScreen(e) {
            if (e.data.id === id && e.data.type === 'result' && e.data.command === 'get-sourceid') {
                window.removeEventListener('message', getScreen);
                constraints.video.mandatory.chromeMediaSourceId = e.data.streamId;
                if (e.data.streamId) {
                    resolve(constraints);
                } else {
                    reject(Error('Missing source parameter'));
                }
            }
        });
        window.postMessage({
            command: 'get-sourceid',
            id: id
        }, '*');
    });
}
