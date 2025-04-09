# Close-Duplicate-Tabs-on-URL-Change
This is a Firefox addon to close duplicate tabs on URL change.

When a new tab is opened or current tab URL changes, 
this addon will automatically close all the tab duplicates with the same URL.

All the other existing duplicate tabs will not be closed and will be maintained, 
until you open an URL that matches them.

**Additionally, this addon will not close:**

* pinned tabs
* about: pages (various Firefox config/info/utility pages)
* moz-extension: pages (various addon-created pages)
* URLs added to the exclusion list in the addon's Options menu
* specific tabs marked as protected (right click on a page background -> Close duplicate tabs -> keep this tab open)

**Other addon functions / settings:**

* You can pause/unpause the addon functionality by clicking its button on the toolbar
* URL of the current page can be quickly added to the list of ignored URLs via a page context menu.
* Notifications can be disabled in the Options menu

**Possible later updates (not yet implemented):**

* wildcards for whitelist of URLs that will be excluded from being closed

**Permissions**

* Access browser tabs - needed to get tab URLs
* Notifications - show notifications
