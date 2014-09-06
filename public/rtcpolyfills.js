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

var RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
var RTCSessionDescription = window.RTCSessionDescription || window.webkitRTCSessionDescription || window.mozRTCSessionDescription;
var RTCIceCandidate = window.RTCIceCandidate || window.webkitRTCIceCandidate || window.mozRTCIceCandidate;

navigator.mediaDevices = navigator.mediaDevices || {};
navigator.mediaDevices.getUserMedia = navigator.mediaDevices.getUserMedia || function(constraints) {
    var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

    return new Promise(getUserMedia.bind(navigator, constraints));
}

if (RTCPeerConnection.prototype.createAnswer.length > 0) {
    window.RTCPeerConnection = (function(RTCPeerConnection) {
        function RTCPromisePeerConnection(constraints) {
            this.connection = new RTCPeerConnection(constraints);
        }

        RTCPromisePeerConnection.prototype = {
            addStream: function() {
                this.connection.addStream.apply(this.connection, arguments);
            },
            createOffer: function() {
                return new Promise(this.connection.createOffer.bind(this.connection));
            },
            createAnswer: function() {
                return new Promise(this.connection.createAnswer.bind(this.connection));
            },
            setLocalDescription: function(sessionDescription) {
                return new Promise(this.connection.setLocalDescription.bind(this.connection, sessionDescription));
            },
            setRemoteDescription: function(sessionDescription) {
                return new Promise(this.connection.setRemoteDescription.bind(this.connection, sessionDescription));
            },
            addIceCandidate: function(candidate) {
                return new Promise(this.connection.addIceCandidate.bind(this.connection, candidate));
            },
            addEventListener: function(event, listener) {
                this.connection.addEventListener(event, listener);
            },
            removeEventListener: function(event, listener) {
                this.connection.removeEventListener(event, listener);
            }
        };

        return RTCPromisePeerConnection;

    }(window.RTCPeerConnection));
}
