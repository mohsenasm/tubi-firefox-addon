// browser.contextMenus.create({
//     id: "add-ranking-to-tubitv",
//     title: "Add ranking to Tubi",
// });

// browser.contextMenus.onClicked.addListener((info, tab) => {
//     if (info.menuItemId === "add-ranking-to-tubitv") {
//         browser.tabs.executeScript({
//             file: "add-ranking.js",
//         });
//     }
// });

browser.browserAction.onClicked.addListener(() => {
    browser.tabs.executeScript({
        file: "add-ranking.js",
    });
});