/* global chrome */

chrome.action.onClicked.addListener(async () => {
    try {
        await chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
    } catch (error) {
        console.error('ImageTrim could not open a new tab.', error);
    }
});
