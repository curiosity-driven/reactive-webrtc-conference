
chrome.runtime.onConnect.addListener(function (port) {
    port.onMessage.addListener(onMessage.bind(port));
});

function onMessage(message) {
    if (message.command == 'get-sourceid' && !message.type) {
        chrome.desktopCapture.chooseDesktopMedia(['screen', 'window'],
            // tab is required so that the sourceId can be used there
            this.sender.tab,
            onStream.bind(this, message.id));
    } else if (message.command == 'check-installed' && !message.type) {
        this.postMessage({
            id: message.id,
            command: 'check-installed',
            type: 'result'
        });
    }
}
function onStream(id, streamId) {
    this.postMessage({
        command: 'get-sourceid',
        type: 'result',
        id: id,
        streamId: streamId
    });
}

chrome.runtime.onInstalled.addListener(injectContentScript);

function injectContentScript() {
    var contentScript = chrome.runtime.getManifest().content_scripts[0];
    chrome.tabs.query({ url: contentScript.matches }, function(tabs) {
        tabs.forEach(function(tab) {
            chrome.tabs.executeScript(tab.id, { file: contentScript.js[0] });
        });
    });
}
