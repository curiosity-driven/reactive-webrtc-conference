Reactive WebRTC Conference
=============================

Simple WebRTC demo that utilizes Observables.

See https://curiosity-driven.org/reactive-webrtc-conference for details.

Local
-----

To start locally use:

    npm install
    npm start

To start in a secure (HTTPS) mode (required for the Screensharing plugin):

    npm start --secure

Heroku
------

To deploy on Heroku:

[![Deploy](https://www.herokucdn.com/deploy/button.png)](https://heroku.com/deploy)

Docker
------

To run inside a Docker container:

    docker build -t webrtcconf:1 .
    docker run --rm -it -p 3000:3000 webrtcconf:1

