# GuacBlocked

GuacBlocked is a Tampermonkey script spiritual successor to **CheekyAvo**. 

Instead of trying to guess hidden price ranges, GuacBlocked pulls the Capital Value (CV) and sticks it right on the TradeMe search results and listing pages.

### What it does
*   Retrieves the CV for each search result from the TradeMe API
*   Adds the CV onto TradeMe search cards so you can see while scrolling
*   Adds the CV to the main price section on listing pages
*   Caches results for a week so you aren't fetching the same data over and over

### Where is this data coming from?
TradeMe listings usually have a data section that breaks down the **Capital Value**, **Land Value**, and **Value of Improvements** (upgrades/the house itself). 

This script pulls the CV from that data. If you want to see the full breakdown (like what the land is worth vs the house), just click into the listing, TradeMe usually shows the full details further down the page.

### Installation
You’ll need a userscript manager like **Tampermonkey** (recommended), **Greasemonkey** (untested), or **Violentmonkey**(untested).

1.  Get the extension (Tampermonkey) for [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) or [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/).
2.  Click on the `GuacBlocked.user.js` file in this repository, then click the **Raw** button at the top right of the code block. Your manager should automatically ask if you want to install it.
3.  Refresh TradeMe and you're good to go.

### Settings
Once the script is running, you'll see a small 🥑 icon in the bottom-right corner of TradeMe. Click that to open the settings menu. You can toggle the script on/off for search results or listing pages, change the cache duration, or clear your stored results.

### Disclaimer
CVs are government ratings for tax purposes and often don't reflect what a house will actually sell for. Use it as a reference, not a rule. Also, using scripts like this probably goes against TradeMe's terms of service, so use it at your own risk.
