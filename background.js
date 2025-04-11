//console.log("Close duplicate tabs on URL change background script loaded successfully");

// State to track if the add-on is active, default to true
let isActive = true;
// Local variable to store ignored URLs
let ignoredUrls = [];
// Set to store protected tab IDs
let protected_tabs = new Set();
// Whether to show notifications
let showNotifications = true; // Default to true

// Queue for URLs to check
let urlQueue = [];
let isProcessing = false;
let debounceTimer = null;
const DEBOUNCE_DELAY = 3000; //milliseconds

// Notification queue
let notificationQueue = [];
let isNotifying = false;
const NOTIFICATION_DELAY = 5000; //milliseconds

// Load protected_tabs from storage on startup
(async () => {
    const data = await browser.storage.local.get("protected_tabs");
    if (data.protected_tabs) {
        protected_tabs = new Set(data.protected_tabs);
    }
})();

// Function to send a browser notification
function sendNotification(title, message) {
    if (!showNotifications) {
        //console.log("Notifications are disabled");
        return;
    }
    
    // Add to queue
    notificationQueue.push({ title, message });
    
    // If not already processing notifications, start
    if (!isNotifying) {
        processNextNotification();
    }
}

// Function to process notifications sequentially
function processNextNotification() {
    if (notificationQueue.length === 0) {
        isNotifying = false;
        return;
    }
    
    isNotifying = true;
    const { title, message } = notificationQueue.shift();
    const notificationId = "duplicate-tab-" + Date.now();
    
    try {
        browser.notifications.create(notificationId, {
            "type": "basic",
            "iconUrl": "icons/addon_logo.svg",
            "title": title,
            "message": message
        }).then((id) => {
            //console.log("Notification created with ID:", id);
            // Clear after 15 seconds (runs independently)
            setTimeout(() => {
                browser.notifications.clear(notificationId);
                //console.log("Notification cleared:", notificationId);
            }, 15000);
            // Move to next notification after NOTIFICATION_DELAY
            setTimeout(() => {
                isNotifying = false;
                processNextNotification();
            }, NOTIFICATION_DELAY);
        }).catch((error) => {
            console.error("Notification creation failed:", error);
            isNotifying = false;
            // Try next notification after NOTIFICATION_DELAY even if this fails
            setTimeout(() => {
                processNextNotification();
            }, NOTIFICATION_DELAY);
        });
    } catch (error) {
        console.error("Error in sendNotification:", error);
        isNotifying = false;
        // Try next notification after NOTIFICATION_DELAY
        setTimeout(() => {
            processNextNotification();
        }, NOTIFICATION_DELAY);
    }
}

// Save protected_tabs to storage whenever it changes
function saveProtectedTabs() {
    browser.storage.local.set({ protected_tabs: Array.from(protected_tabs) });
}

// Function to load settings from storage
function loadSettings() {
    browser.storage.local.get(['ignoredUrls', 'showNotifications'], (data) => {
        ignoredUrls = data.ignoredUrls || [];
        showNotifications = data.showNotifications !== undefined ? data.showNotifications : true;
        //console.log("Loaded settings:", ignoredUrls, showNotifications);
    });
}

// Load settings initially
loadSettings();

// Listen for changes to storage and update settings
browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        if (changes.ignoredUrls) {
            ignoredUrls = changes.ignoredUrls.newValue || [];
            //console.log("Ignored URLs updated:", ignoredUrls);
        }
        if (changes.showNotifications) {
            showNotifications = changes.showNotifications.newValue;
            //console.log("Show notifications updated:", showNotifications);
        }
    }
});

// Function to update the browser action button’s appearance
function updateButton() {
    if (isActive) {
        browser.browserAction.setIcon({
            path: {
                "32": "icons/addon_logo_active.svg"
            }
        });
        browser.browserAction.setTitle({ title: "Close duplicate tabs on URL change (Active)" });
    } else {
        browser.browserAction.setIcon({
            path: {
                "32": "icons/addon_logo_inactive.svg"
            }
        });
        browser.browserAction.setTitle({ title: "Close duplicate tabs on URL change (Inactive)" });
    }
}

// Toggle the add-on state when the button is clicked
browser.browserAction.onClicked.addListener(() => {
    isActive = !isActive;
    //console.log("Add-on toggled to:", isActive ? "Active" : "Inactive");
    updateButton();
});

// Queue management functions
function addToQueue(tabId, url) {
     // Skip if the add-on is inactive, skip special URLs, ignored URLs
    if (!isActive || url.startsWith("about:") || url.startsWith("moz-extension:") || ignoredUrls.includes(url)) {
        return;
    }
    
    urlQueue.push({ tabId, url });
    
    if (isProcessing) {
        // If currently processing, handle it after current item
        return;
    }
    
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processQueue, DEBOUNCE_DELAY);
}

function processQueue() {
    if (isProcessing || urlQueue.length === 0) return;
    
    isProcessing = true;
    
    // Remove duplicate URLs from queue, keeping latest tabId
    const uniqueQueue = [];
    const seenUrls = new Set();
    
    for (let i = urlQueue.length - 1; i >= 0; i--) {
        const item = urlQueue[i];
        if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            uniqueQueue.unshift(item);
        }
    }
    
    urlQueue = [];
    processNextItem(uniqueQueue);
}

function processNextItem(queue) {
    if (queue.length === 0) {
        isProcessing = false;
        if (urlQueue.length > 0) {
            // New items added during processing, start timer again
            debounceTimer = setTimeout(processQueue, DEBOUNCE_DELAY);
        }
        return;
    }
    
    const { tabId, url } = queue.shift();
    
    // Check if the URL has a fragment identifier
    if (url.includes('#')) {
        // Use less efficient method: fetch all tabs and filter manually
        browser.tabs.query({}, (allTabs) => {
            const matchingTabs = allTabs.filter(t => t.url === url);
            //console.log("Found tabs with URL (fragment method)", url, ":", matchingTabs.map(t => ({ id: t.id, url: t.url, pinned: t.pinned })));
            processTabs(matchingTabs, tabId, url, queue);
        });
    } else {
        // Use efficient method: query only matching URLs
        browser.tabs.query({ url }, (tabs) => {
            //console.log("Found tabs with URL (exact match method)", url, ":", tabs.map(t => ({ id: t.id, url: t.url, pinned: t.pinned })));
            processTabs(tabs, tabId, url, queue);
        });
    }
}

function processTabs(tabs, tabId, url, queue) {
    //skip pinned and protected tabs
    const tabsToClose = tabs
        .filter(t => t.id !== tabId && !t.pinned && !protected_tabs.has(t.id))
        .map(t => t.id);
    
    if (tabsToClose.length > 0) {
        browser.tabs.remove(tabsToClose);
        sendNotification(`Closed ${tabsToClose.length} duplicate tab(s) for:`, url);
    } else {
        //console.log("No unpinned, unprotected duplicates found to close.");
    }
    
    processNextItem(queue);
}

// Context menu setup with icon
browser.contextMenus.create({
    id: "close-duplicate-tabs-url-menu",
    title: "Close duplicate tabs",
    contexts: ["page"]
});

browser.contextMenus.create({
    id: "keep-this-tab-open",
    parentId: "close-duplicate-tabs-url-menu",
    title: "Keep this tab open",
    contexts: ["page"]
});

browser.contextMenus.create({
    id: "ignore-current-url",
    parentId: "close-duplicate-tabs-url-menu",
    title: "Ignore current URL",
    contexts: ["page"]
});

// Handle context menu click
browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "keep-this-tab-open") {
        protected_tabs.add(tab.id);
        saveProtectedTabs();
        //console.log(`Tab ${tab.id} added to protected_tabs:`, protected_tabs);
        sendNotification(`Current tab is marked as protected`, ``);
    } else if (info.menuItemId === "ignore-current-url") {
        const url = tab.url;
        browser.storage.local.get('ignoredUrls').then((data) => {
            let ignoredUrls = data.ignoredUrls || [];
            if (!ignoredUrls.includes(url)) {
                ignoredUrls.push(url);
                browser.storage.local.set({ ignoredUrls }).then(() => {
                    //console.log('Ignored URLs updated');
                    sendNotification(`The following URL is added to ignore list:`, `${tab.url}`);
                });
            } else {
                //console.log('URL already ignored');
                sendNotification(`This URL is already ignored`, ``);
            }
        });
    }
});

// Listen for tab updates and check for duplicates
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Skip if the add-on is inactive
    if (!isActive) return;

    // Check for URL changes
    if (changeInfo.url) {
        //console.log("Tab updated with ID:", tabId, "and URL:", tab.url);
        addToQueue(tabId, tab.url);
    }
});


// Clean up protected_tabs when tabs are closed
browser.tabs.onRemoved.addListener((tabId) => {
    if (protected_tabs.has(tabId)) {
        protected_tabs.delete(tabId);
        saveProtectedTabs();
    }
});

// Initialize the button state
updateButton();