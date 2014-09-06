

openssl req -new -newkey rsa:2048 -days 3650 -nodes -x509 -sha256 -subj "/CN=Curiosity driven" -keyout server.key -out server.crt
