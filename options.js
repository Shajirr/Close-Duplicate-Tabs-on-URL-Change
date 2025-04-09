document.addEventListener('DOMContentLoaded', () => {
    browser.storage.local.get(['ignoredUrls', 'showNotifications'], (data) => {
        // Load ignored URLs
        const ignoredUrls = data.ignoredUrls || [];
        document.getElementById('ignoredUrls').value = ignoredUrls.join('\n');
        
        // Load showNotifications, default to true if not set
        const showNotifications = data.showNotifications !== undefined ? data.showNotifications : true;
        document.getElementById('showNotifications').checked = showNotifications;
    });
});

document.getElementById('save').addEventListener('click', () => {
    const textarea = document.getElementById('ignoredUrls');
    const ignoredUrls = textarea.value
        .split('\n')
        .map(url => url.trim())
        .filter(url => url !== '');
    
    // Get the checkbox state
    const showNotifications = document.getElementById('showNotifications').checked;
    
    // Save both settings
    browser.storage.local.set({ ignoredUrls, showNotifications }, () => {
        //console.log('Settings saved');
    });
});