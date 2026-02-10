// ==UserScript==
// @name         GuacBlocked
// @namespace    https://github.com/jamesschoch/GuacBlocked/
// @version      1.0.1
// @description  Adds capital value to TradeMe search results and listing pages with request queueing, logging, and rate limiting
// @author       James Schoch
// @match        https://www.trademe.co.nz/a/property/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=trademe.co.nz
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

(function () {
    'use strict';

    const style = document.createElement('style');
    style.textContent = `
        #cv-settings-modal {
            align-items: center;
            justify-content: center;
        }
    `;
    document.head.appendChild(style);

    const DEFAULTS = {
        enableSearch: true,
        enableListing: true,
        cacheDays: 7,
        rateLimitMs: 250
    };

    const getSetting = (key) => GM_getValue(key, DEFAULTS[key]);
    const setSetting = (key, val) => GM_setValue(key, val);


    let requestQueue = [];
    let isProcessingQueue = false;

    async function processQueue() {
        if (isProcessingQueue || requestQueue.length === 0) return;
        isProcessingQueue = true;

        while (requestQueue.length > 0) {
            const { listingId, callback } = requestQueue.shift();
            const { cv, wasCached } = await fetchCv(listingId);
            callback(cv);

            if (!wasCached) {
                await new Promise(resolve => setTimeout(resolve, getSetting('rateLimitMs')));
            }
        }

        isProcessingQueue = false;
    }

    function getCache() { return GM_getValue('cv_cache', {}); }
    function getCachedCv(id) {
        const cache = getCache();
        const entry = cache[id];
        if (entry) {
            const now = new Date().getTime();
            const expiry = getSetting('cacheDays') * 24 * 60 * 60 * 1000;
            if (now - entry.timestamp < expiry) return entry.cv;
            delete cache[id];
            GM_setValue('cv_cache', cache);
        }
        return null;
    }

    async function fetchCv(listingId) {
        const cached = getCachedCv(listingId);
        if (cached) return { cv: cached, wasCached: true };

        console.log(`API Call for ID: ${listingId}...`);

        try {
            const response = await fetch(`https://api.trademe.co.nz/v1/listings/${listingId}.json`);

            if (response.status === 429) {
                console.warn(`Possibly rate limited (429). Increase delay in settings.`);
                return { cv: null, wasCached: false };
            }

            if (!response.ok) {
                console.error(`API error for ${listingId}: Status ${response.status}`);
                return { cv: null, wasCached: false };
            }

            const data = await response.json();
            let cv = null;

            if (data.PropertyAttributes) {
                const attr = data.PropertyAttributes.find(a => a.Name === 'capital_value');
                cv = attr?.Value;
            }

            if (cv) {
                console.log(`Found CV for ${listingId}: ${cv}`);
                const cache = getCache();
                cache[listingId] = { cv: cv, timestamp: new Date().getTime() };
                GM_setValue('cv_cache', cache);
            } else {
                console.log(`No CV attribute found in response for ${listingId}.`);

                const cache = getCache();
                cache[listingId] = { cv: "Not found", timestamp: new Date().getTime() };
                GM_setValue('cv_cache', cache);
            }

            return { cv: cv, wasCached: false };
        } catch (e) {
            console.error(`Fetch failed:`, e);
            return { cv: null, wasCached: false };
        }
    }

    async function processCard(card) {
        if (!getSetting('enableSearch') || card.classList.contains('cv-processed')) return;

        const link = card.querySelector('a[href*="/listing/"]');
        let listingId = link?.getAttribute('href')?.match(/listing\/(\d+)/)?.[1];

        if (!listingId) {
            const dataAttr = card.querySelector('[data-aria-id]')?.getAttribute('data-aria-id');
            listingId = dataAttr?.split('-')[1];
        }

        if (!listingId) return;
        card.classList.add('cv-processed');

        const priceEl = card.querySelector('.tm-property-search-card-price-attribute__price');
        if (priceEl && !priceEl.querySelector('.cv-spinner')) {
            $('<div class="cv-spinner" style="font-size: 13px; color: #999; margin-top: 2px;">Loading...</div>').appendTo(priceEl);
        }

        requestQueue.push({
            listingId,
            callback: (cv) => {
                const priceEl = card.querySelector('.tm-property-search-card-price-attribute__price');
                if (!priceEl) return;

                priceEl.querySelectorAll('.cv-spinner').forEach(el => el.remove());

                if (cv && cv !== "Not found") {
                    if (!priceEl.querySelector('.cv-tag')) {
                        $('<div class="cv-tag">').text(`🥑 ${cv}`).css({
                            'font-size': '13px', 'color': '#29a754', 'font-weight': '700', 'margin-top': '2px'
                        }).appendTo(priceEl);
                    }
                } else {
                    if (!priceEl.querySelector('.cv-not-found')) {
                        $('<div class="cv-not-found">').text('Capital value not found').css({
                            'font-size': '13px', 'color': '#999', 'margin-top': '2px'
                        }).appendTo(priceEl);
                    }
                }
            }
        });
        processQueue();
    }

    async function processListingPage() {
        if (!getSetting('enableListing')) return;
        const container = document.querySelector('.tm-property-listing-body__price');
        if (!container || container.classList.contains('cv-processed')) return;

        const listingId = window.location.pathname.match(/listing\/(\d+)/)?.[1];
        if (!listingId) return;

        container.classList.add('cv-processed');

        $('<div class="cv-spinner">').text('⏳ Loading Capital Value...').css({
            'font-size': '16px', 'color': '#999', 'padding': '10px 0', 'display': 'block'
        }).appendTo(container);

        const { cv } = await fetchCv(listingId);

        container.querySelector('.cv-spinner')?.remove();

        if (cv && cv !== "Not found") {
            if (!container.querySelector('.cv-tag')) {
                $('<div class="cv-tag">').text(`Capital Value (CV): ${cv}`).css({
                    'font-size': '18px', 'color': '#29a754', 'font-weight': 'bold', 'padding': '10px 0', 'display': 'block'
                }).appendTo(container);
            }
        } else {
            if (!container.querySelector('.cv-not-found')) {
                $('<div class="cv-not-found">').text('Capital value not found').css({
                    'font-size': '16px', 'color': '#999', 'padding': '10px 0', 'display': 'block'
                }).appendTo(container);
            }
        }
    }

    function createSettingsUI() {
        const btn = $('<div id="cv-settings-btn">🥑</div>').css({
            position: 'fixed', bottom: '20px', right: '20px', width: '40px', height: '40px',
            background: '#fff', border: '1px solid #ccc', borderRadius: '50%', textAlign: 'center',
            lineHeight: '40px', cursor: 'pointer', zIndex: 9999, boxShadow: '0 2px 5px rgba(0,0,0,0.2)', fontSize: '20px'
        }).appendTo('body');

        const updateStats = () => {
            $('#cv-cache-count').text(Object.keys(getCache()).length);
        };

        const modal = $(`
            <div id="cv-settings-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:10000; display:none;">
                <div class="o-card" style="background:white; max-width:420px; padding:25px; border-radius:12px; margin: 80px;">
                    <h2 style="margin-top:0;">GuacBlocked</h2>
                    <label style="display:block; margin-bottom:10px;"><input type="checkbox" id="set-search" ${getSetting('enableSearch') ? 'checked' : ''}> Enable on Search Results</label>
                    <label style="display:block; margin-bottom:10px;"><input type="checkbox" id="set-listing" ${getSetting('enableListing') ? 'checked' : ''}> Enable on Listing Pages</label>

                    <div style="">
                        <label>Delay between calls (ms): <input type="number" id="set-delay" value="${getSetting('rateLimitMs')}" style="width:70px; padding:3px;"></label>
                    </div>

                    <div style="">
                        <label>Cache Duration (Days): <input type="number" id="set-cache" value="${getSetting('cacheDays')}" style="width:50px; padding:3px;"></label>
                    </div>

                    <hr style="border:0; border-top:1px solid #eee;margin: 10px 0px">

                    <div style="margin-bottom: 15px;">
                        Stored results in cache: <strong id="cv-cache-count">0</strong>
                        <button id="cv-clear-cache" class="o-button2" style="display:block; margin-top:8px;">Clear Cache</button>
                    </div>

                    <div style="display:flex; justify-content: flex-end; gap: 10px;">
                        <button id="cv-close" class="o-transparent-button2" style="margin-bottom: 0;">Cancel</button>
                        <button id="cv-save" class="o-button2 o-button2--primary" style="margin-bottom: 0;">Save & Reload</button>
                    </div>
                </div>
            </div>
        `).appendTo('body');

        btn.on('click', () => { updateStats(); modal.css('display', 'flex'); });
        $('#cv-close').on('click', () => modal.css('display', 'none'));
        $('#cv-clear-cache').on('click', () => { if (confirm('Clear cache?')) { GM_setValue('cv_cache', {}); updateStats(); } });

        $('#cv-save').on('click', () => {
            setSetting('enableSearch', $('#set-search').is(':checked'));
            setSetting('enableListing', $('#set-listing').is(':checked'));
            setSetting('rateLimitMs', parseInt($('#set-delay').val()) || 250);
            setSetting('cacheDays', parseInt($('#set-cache').val()) || 7);
            location.reload();
        });
    }

    function scan() {
        if (window.location.pathname.includes('/search') || window.location.pathname.includes('/property/')) {
            const cards = document.querySelectorAll([
                'tg-col[flexcontents="true"]:not(.cv-processed)',
                'tm-property-super-feature-card:not(.cv-processed)',
                'tm-property-premium-listing-card:not(.cv-processed)'
            ].join(','));
            cards.forEach(processCard);
        }

        if (window.location.pathname.includes('/listing/')) {
            processListingPage();
        }
    }

    createSettingsUI();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    scan();

})();
