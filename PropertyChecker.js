// ==UserScript==
// @name         Torn Properties Manager
// @namespace    http://tampermonkey.net/
// @version      3.9
// @description  Adds a property management dashboard to Torn's properties page with expiration tracking, offer status, and pagination
// @author       beans_ [174079]
// @match        https://www.torn.com/properties.php*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Constants for styling and configuration
    const STYLES = {
        container: 'margin: 20px; background: #2d2d2d; padding: 15px; border-radius: 5px;',
        button: 'background: #444; color: #fff; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;',
        tableCell: 'padding: 8px; border-bottom: 1px solid #444; color: #fff;',
        statusColors: {
            offered: 'rgba(0, 255, 0, 0.1)',
            expired: 'rgba(255, 0, 0, 0.1)',
            warning: 'rgba(255, 165, 0, 0.1)',
            hover: 'rgba(255, 255, 255, 0.1)'
        },
        stats: {
            section: 'margin-top: 15px; text-align: center;',
            toggleButton: 'background: #444; color: #fff; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;',
            content: 'margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 4px; text-align: left;',
            flexContainer: `
                display: flex; 
                gap: 20px;
                @media (max-width: 768px) {
                    flex-direction: column;
                }
            `.replace(/\s+/g, ' ').trim(),
            column: 'flex: 1;',
            divider: `
                width: 1px; 
                background: #444;
                @media (max-width: 768px) {
                    width: 100%;
                    height: 1px;
                    margin: 10px 0;
                }
            `.replace(/\s+/g, ' ').trim(),
            heading: 'color: #fff; margin: 0 0 15px 0;',
            subheading: 'color: #888; font-size: 0.8em; margin: -10px 0 15px 0;',
            grid: 'display: grid; gap: 10px;',
            card: 'background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; transition: background 0.2s;',
            cardLabel: 'font-size: 0.9em; color: #888; margin-bottom: 5px;',
            cardValue: 'font-size: 1.2em; color: #fff; font-weight: 500;',
            input: {
                container: 'display: flex;',
                field: 'flex: 1; padding: 8px; background: #444; color: #fff; border: 1px solid #666; border-radius: 4px; font-size: 1.1em;',
                fieldLeft: 'border-radius: 4px 0 0 4px; border-right: none;',
                fieldFull: 'width: calc(100% - 18px);',
                button: 'background: #444; color: #fff; border: 1px solid #666; border-radius: 0 4px 4px 0; padding: 8px 12px; text-decoration: none; display: flex; align-items: center;'
            },
            calculateButton: 'background: #444; color: #fff; border: 1px solid #666; padding: 10px; border-radius: 4px; cursor: pointer; width: 100%; font-size: 1.1em; transition: background 0.2s;',
            results: {
                container: 'display: none; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px;',
                grid: 'display: grid; gap: 12px; grid-template-columns: repeat(2, 1fr);'
            }
        },
        mobileTable: `
            @media screen and (max-width: 768px) {
                table, thead, tbody, tr, th, td {
                    display: block;
                }
                
                thead tr {
                    position: absolute;
                    top: -9999px;
                    left: -9999px;
                }
                
                tr {
                    margin-bottom: 15px;
                    background: rgba(0,0,0,0.2);
                    border-radius: 5px;
                    padding: 10px;
                }
                
                td {
                    position: relative;
                    padding-left: 50% !important;
                    border-bottom: none !important;
                }

                /* Special handling for property name, status, and days left */
                td:nth-of-type(1),
                td:nth-of-type(2),
                td:nth-of-type(3) {
                    display: inline-block;
                    padding-left: 0 !important;
                    width: auto;
                }

                td:nth-of-type(1)::after {
                    content: " - ";
                    margin: 0 5px;
                }

                td:nth-of-type(2)::after {
                    content: " - ";
                    margin: 0 5px;
                }

                td:nth-of-type(3) {
                    padding-left: 0 !important;
                }

                td:nth-of-type(3)::after {
                    content: " days left";
                }

                /* Daily Rent styling */
                td:nth-of-type(4) {
                    margin: 10px 0;
                    padding-left: 0 !important;
                }
                
                td:nth-of-type(4)::before {
                    content: "Daily Rent: $";
                    position: static;
                    width: auto;
                }

                /* Create a flex container for buttons */
                tr {
                    position: relative;
                }

                /* Button row styling */
                td:nth-of-type(5),
                td:nth-of-type(6) {
                    display: inline-block;
                    width: calc(50% - 2.5px);
                    padding: 0 !important;
                    margin: 10px 0 0 0;
                    vertical-align: top;
                }

                td:nth-of-type(5) {
                    margin-right: 2.5px;
                }

                td:nth-of-type(6) {
                    margin-left: 2.5px;
                }

                /* Button styling */
                td:nth-of-type(5) a,
                td:nth-of-type(6) button {
                    width: 100%;
                    padding: 10px !important;
                    text-align: center;
                    font-size: 1.1em;
                    box-sizing: border-box;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0;
                    border-radius: 3px;
                    min-height: 37px;  /* Set explicit height to match */
                    line-height: 1.2;
                }
                
                /* Adjust filter section */
                .filter-section {
                    flex-direction: column;
                    gap: 10px;
                }
                
                .filter-section > div {
                    width: 100% !important;
                    max-width: 100% !important;
                }
                
                /* Adjust pagination */
                .page-info-row {
                    margin: 15px 0;
                }
            }
        `
    };

    const CONFIG = {
        ITEMS_PER_PAGE: 15,
        REFRESH_COOLDOWN: 60000, // 1 minute in milliseconds
        MAX_RETRIES: 30,
        RETRY_DELAY: 100,
        API_ENDPOINT: 'https://api.torn.com/v2'
    };

    // Cache DOM queries
    const getElement = (selector) => document.querySelector(selector);
    const createElement = (html) => {
        const div = document.createElement('div');
        div.innerHTML = html.trim();
        return div.firstChild;
    };

    /**
     * Handles API requests with error handling and rate limiting
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Request options
     * @returns {Promise} API response
     */
/*     async function fetchAPI(endpoint, options = {}) {
        const apiKey = localStorage.getItem('tornApiKey');
        if (!apiKey) throw new Error('No API key found');

        try {
            const response = await fetch(`${CONFIG.API_ENDPOINT}/${endpoint}?key=${apiKey}${options.params || ''}`);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(`API Error: ${data.error.error}`);
            }
            
            return data;
        } catch (error) {
            handleApiError(error);
            throw error;
        }
    } */

    /**
     * Debounces a function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

/*     // Optimize property data processing
    function processPropertyData(properties) {
        return Object.entries(properties)
            .filter(([id, prop]) => 
                prop.status !== "Owned by their spouse" && 
                id !== localStorage.getItem('currentPropertyId')
            )
            .map(([id, prop]) => ({
                propertyId: id,
                name: prop.property,
                status: prop.rented ? "Rented" : "Available",
                daysLeft: prop.rented ? prop.rented.days_left : 0,
                renew: `https://www.torn.com/properties.php#/p=options&ID=${id}&tab=${prop.rented ? 'offerExtension' : 'lease'}`,
                offerMade: localStorage.getItem(`property_offer_${id}`) !== null,
                costPerDay: prop.rented ? prop.rented.cost_per_day : 0,
                buttonValue: prop.rented ? "Renew" : "Lease",
                rentedBy: prop.rented ? prop.rented.user_id : null
            }))
            .sort((a, b) => a.daysLeft - b.daysLeft);
    } */

/*     // Optimize table updates with DocumentFragment
    function updateTableRows(tbody, properties) {
        const fragment = document.createDocumentFragment();
        
        properties.forEach(prop => {
            const row = document.createElement('tr');
            const baseColor = getPropertyRowColor(prop);
            
            row.style.cssText = `transition: background-color 0.2s ease; cursor: pointer; background-color: ${baseColor};`;
            
            const handleHover = (isHover) => {
                row.style.backgroundColor = isHover ? STYLES.statusColors.hover : baseColor;
            };
            
            row.addEventListener('mouseenter', () => handleHover(true));
            row.addEventListener('mouseleave', () => handleHover(false));
            
            row.innerHTML = `
                <td style="${STYLES.tableCell}">${prop.propertyId}</td>
                <td style="${STYLES.tableCell}">${prop.name}</td>
                <td style="${STYLES.tableCell}">${prop.offerMade ? 'Offered' : prop.status}</td>
                <td style="${STYLES.tableCell}">${prop.daysLeft}</td>
                <td style="${STYLES.tableCell}">
                    <a href="${prop.renew}" target="_blank" style="${STYLES.button}; text-decoration: none;">${prop.buttonValue}</a>
                </td>
            `;
            
            fragment.appendChild(row);
        });
        
        tbody.innerHTML = '';
        tbody.appendChild(fragment);
    }
 */
    // Optimize observers with weak references
    function setupNavigationObserver() {
        // Create a more specific observer for the properties content
        const contentObserver = new MutationObserver(
            debounce((mutations) => {
                const propertiesContainer = document.querySelector('.properties-container');
                const propertiesPageWrap = document.querySelector('#properties-page-wrap');
                
                // If our container is gone but we're still on the properties page, recreate it
                if (!propertiesContainer && propertiesPageWrap) {
                    createPropertiesTable();
                    getUserId();
                    observeOfferSubmissions();
                }
            }, 100)
        );

        // Start observing the body for React navigation changes
        contentObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Also watch for URL hash changes which might indicate React navigation
        window.addEventListener('hashchange', () => {
            setTimeout(() => {
                const propertiesContainer = document.querySelector('.properties-container');
                const propertiesPageWrap = document.querySelector('#properties-page-wrap');
                
                if (!propertiesContainer && propertiesPageWrap) {
                    createPropertiesTable();    
                    getUserId();
                    observeOfferSubmissions();
                }
            }, 100); // Small delay to let React render
        });
    }

    /**
     * Creates a styled button element
     * @param {string} text - Button text
     * @param {string} id - Button ID
     * @returns {string} HTML button string
     */
/*     function createButton(text, id) {
        return `<button id="${id}" style="${STYLES.button}">${text}</button>`;
    } */

    /**
     * Determines the background color for a property row
     * @param {Object} property - Property data
     * @returns {string} CSS background-color value
     */
    function getPropertyRowColor(property) {
        if (property.offerMade) return STYLES.statusColors.offered;
        if (property.daysLeft === 0) return STYLES.statusColors.expired;
        if (property.daysLeft <= 10) return STYLES.statusColors.warning;
        return '';
    }

    function createApiKeyForm(isIncorrectKey = false) {
        return `
            <div class="properties-container" style="${STYLES.container}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h2 style="color: #fff; margin: 0;">Properties Manager</h2>
                </div>
                <div style="text-align: center;">
                    ${isIncorrectKey ? 
                        `<p style="color: #ff6666; margin-bottom: 15px;">Incorrect API Key detected. Please enter a new one:</p>` :
                        `<p style="color: #fff; margin-bottom: 15px;">Please enter your Torn API key to continue:</p>`
                    }
                    <input type="text" id="torn-api-key" style="padding: 5px; margin-right: 10px; background: #444; color: #fff; border: 1px solid #666; border-radius: 3px;">
                    <button id="submit-api-key" style="${STYLES.button}">Submit</button>
                </div>
            </div>`;
    }

    function createPropertiesTable() {
        // Remove any existing containers that might be stale
        const existingContainers = document.querySelectorAll('.properties-container');
        existingContainers.forEach(container => container.remove());

        // Check for API key first
        const apiKey = localStorage.getItem('tornApiKey');
        const targetElement = document.querySelector('#properties-page-wrap');
        
        // Wait for target element to exist with a maximum number of retries
        if (!targetElement) {
            if (!window.propertiesRetryCount) {
                window.propertiesRetryCount = 0;
            }
            
            if (window.propertiesRetryCount < 30) { // Try for up to 3 seconds (30 * 100ms)
                window.propertiesRetryCount++;
                setTimeout(createPropertiesTable, 100);
            } else {
                console.error('Properties Manager: Failed to find #properties-page-wrap after 30 attempts');
                window.propertiesRetryCount = 0;
            }
            return;
        }
        
        // Reset retry count on success
        window.propertiesRetryCount = 0;

        if (!apiKey && targetElement) {
            targetElement.insertAdjacentHTML('afterbegin', createApiKeyForm());

            // Add API key submission handler
            document.getElementById('submit-api-key').addEventListener('click', function() {
                const apiKeyInput = document.getElementById('torn-api-key');
                if (apiKeyInput.value) {
                    localStorage.setItem('tornApiKey', apiKeyInput.value);
                    document.querySelector('.properties-container').remove();
                    createPropertiesTable();
                }
            });

            return;
        }

        const tableHTML = `
            <style>${STYLES.mobileTable}</style>
            <div class="properties-container" style="${STYLES.container}">
                <div class="properties-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h2 style="color: #fff; margin: 0; cursor: pointer;">Properties Manager</h2>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="collapse-icon" style="color: #fff; font-size: 20px; cursor: pointer;">▶</span>
                    </div>
                </div>
                <div class="properties-content" style="display: none;">
                    <div class="filter-section" style="margin-bottom: 15px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 10px; flex: 0 1 auto; max-width: 200px; width: 100%;">
                            <input type="text" 
                                   id="player-id-search" 
                                   placeholder="Search by Player ID" 
                                   style="padding: 5px; background: #444; color: #fff; border: 1px solid #666; border-radius: 3px; width: calc(100% - 70px);">
                            <button id="clear-search" style="${STYLES.button}">Clear</button>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                            <label style="color: #fff; display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" id="hide-offered" style="cursor: pointer;">
                                Hide Offered
                            </label>
                            <label style="color: #fff; display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" id="hide-available" style="cursor: pointer;">
                                Hide Available
                            </label>
                            <button id="refresh-properties" style="${STYLES.button}">Refresh</button>
                        </div>
                    </div>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; color: #fff;">
                            <thead>
                                <tr>
                                    <th style="display: none;">Property ID</th>
                                    <th style="padding: 8px; text-align: left; border-bottom: 1px solid #444; font-weight: bold;">Property Name</th>
                                    <th style="padding: 8px; text-align: left; border-bottom: 1px solid #444; font-weight: bold;">Status</th>
                                    <th style="padding: 8px; text-align: left; border-bottom: 1px solid #444; font-weight: bold;">Days Left</th>
                                    <th style="padding: 8px; text-align: left; border-bottom: 1px solid #444; font-weight: bold;">Daily Rent</th>
                                    <th style="padding: 8px; text-align: left; border-bottom: 1px solid #444; font-weight: bold;">Renew</th>
                                    <th style="padding: 8px; text-align: left; border-bottom: 1px solid #444; font-weight: bold;">Offer</th>
                                </tr>
                            </thead>
                            <tbody id="properties-table-body">
                            </tbody>
                        </table>
                    </div>
                    <div class="page-info-row" style="text-align: center; margin: 10px 0;">
                        <span id="page-info" style="color: #fff; display: inline-block; padding: 5px 10px; background: rgba(0,0,0,0.2); border-radius: 4px;">Page 1</span>
                    </div>
                    <div class="pagination" style="margin-top: 15px; display: flex; justify-content: center; gap: 10px; width: 100%; max-width: 100%; overflow: hidden;">
                        <button id="prev-page" style="${STYLES.button}">Previous</button>
                        <button id="next-page" style="${STYLES.button}">Next</button>
                    </div>
                </div>
            </div>`;

        if (targetElement) {
            targetElement.insertAdjacentHTML('afterbegin', tableHTML);
            
            // Add variable declarations at the top
            const header = document.querySelector('.properties-header');
            const content = document.querySelector('.properties-content');
            const icon = document.querySelector('.collapse-icon');
            const refreshButton = document.getElementById('refresh-properties');
            let dataFetched = false;
            let lastRefreshTime = 0;
            
            header.addEventListener('click', () => {
                const isVisible = content.style.display !== 'none';
                content.style.display = isVisible ? 'none' : 'block';
                icon.textContent = isVisible ? '▶' : '▼';
                
                // Only fetch data the first time we expand
                if (!isVisible && !dataFetched) {
                    getPropertyData();
                    dataFetched = true;
                }
            });

            refreshButton.addEventListener('click', () => {
                const currentTime = Date.now();
                const timeSinceLastRefresh = currentTime - lastRefreshTime;
                
                if (timeSinceLastRefresh >= 60000) { // 60000ms = 1 minute
                    getPropertyData();
                    lastRefreshTime = currentTime;
                } else {
                    const secondsRemaining = Math.ceil((60000 - timeSinceLastRefresh) / 1000);
                    alert(`Please wait ${secondsRemaining} seconds before refreshing again.`);
                }
            });
        }
    }

    /**
     * Handles API errors and displays appropriate messages
     * @param {Object} error - Error object
     */
    function handleApiError(error) {
        console.error('Error fetching property data:', error);
        
        // Check if it's an incorrect API key error
        if (error.message.includes('Incorrect key')) {
            // Clear the invalid API key
            localStorage.removeItem('tornApiKey');
            
            // Remove existing container if present
            const existingContainer = document.querySelector('.properties-container');
            if (existingContainer) {
                existingContainer.remove();
            }
            
            // Show the API key form
            const targetElement = document.querySelector('#properties-page-wrap');
            if (targetElement) {
                targetElement.insertAdjacentHTML('afterbegin', createApiKeyForm(true));
                
                // Add API key submission handler
                document.getElementById('submit-api-key').addEventListener('click', function() {
                    const apiKeyInput = document.getElementById('torn-api-key');
                    if (apiKeyInput.value) {
                        localStorage.setItem('tornApiKey', apiKeyInput.value);
                        document.querySelector('.properties-container').remove();
                        createPropertiesTable();
                    }
                });
            }
        } else {
            // Handle other errors with alert
            const message = error.message.includes('API Error') 
                ? error.message 
                : 'Error fetching property data. Please check your API key and try again.';
            alert(message);
        }
    }

    async function getAllProperties(apiKey) {
        let allProperties = [];
        let offset = 0;
        let batchSize = 100;
        let hasMore = true;

        while (hasMore) {
            const response = await fetch(`https://api.torn.com/v2/user/properties?key=${apiKey}&offset=${offset}`);
            const data = await response.json();

            if (data.error) throw new Error(`API Error: ${data.error.error}`);
            if (!data.properties) throw new Error('Invalid API response: missing properties data');

            // Convert the object to an array and add to allProperties
            allProperties = allProperties.concat(Object.entries(data.properties));

            console.log(`Fetched batch at offset ${offset}:`, Object.keys(data.properties).length, 'properties');

            const batchCount = Object.keys(data.properties).length;
            if (batchCount < batchSize) {
                hasMore = false;
            } else {
                offset += batchSize;
            }
        }

        console.log('Total properties fetched:', allProperties.length); //4837907
        return allProperties;
    }

    async function getPropertyData() {
        const apiKey = localStorage.getItem('tornApiKey');
        const currentUserId = localStorage.getItem('property_currentUserId');

        console.log("currentUserId: " + currentUserId);

        if (!apiKey) return;

        try {
            const allProperties = await getAllProperties(apiKey);

            // Clean up localStorage before processing properties
            allProperties.forEach(([id, prop]) => {
                const storedOffer = localStorage.getItem(`property_offer_${prop.id}`);

                if (storedOffer && prop.status === "rented" && 
                    (prop.rental_period_remaining > parseInt(storedOffer) ||
                     prop.rental_period_remaining == 0)) {
                    localStorage.removeItem(`property_offer_${prop.id}`);
                }
            });

            let properties = allProperties
                .filter(([id, prop]) =>
                    
                    !(prop.status === "none" && Number(prop.owner.id) !== Number(currentUserId)) && 
                    prop.status !== "in_use"
                )
                .map(([id, prop]) => ({
                    propertyId: prop.id,
                    name: prop.property.name,
                    status: prop.status,
                    daysLeft: prop.status !== "none" ? (prop.rental_period_remaining || 0) : 0,
                    renew: prop.status == "rented" ?`https://www.torn.com/properties.php#/p=options&ID=${prop.id}&tab=offerExtension` : `https://www.torn.com/properties.php#/p=options&ID=${prop.id}&tab=lease`,
                    offerMade: localStorage.getItem(`property_offer_${prop.id}`) !== null,
                    costPerDay: prop.status == "rented" ? prop.cost_per_day : 0,
                    buttonValue: prop.status == "rented" ? "Renew" : "Lease",
                    rentedBy: prop.status == "rented"   ? prop.used_by.id : null
                }));

            console.log('Properties after filtering:', properties.length);

            properties = properties.sort((a, b) => a.daysLeft - b.daysLeft);

            updateTable(properties);

            // Store the days left for each property
            properties.forEach(prop => {
                window.propertyDaysLeft = window.propertyDaysLeft || {};
                window.propertyDaysLeft[prop.propertyId] = prop.daysLeft;
            });


        } catch (err) {
            handleApiError(err);
        }
    }

    function updateTable(properties) {
        const tbody = document.getElementById('properties-table-body');
        const prevButton = document.getElementById('prev-page');
        const nextButton = document.getElementById('next-page');
        const pageInfo = document.getElementById('page-info');
        if (!tbody) return;
        
        const itemsPerPage = 15;
        let currentPage = 1;
        const totalPages = Math.ceil(properties.length / itemsPerPage);
        
        // Add statistics section after pagination
        const statsSection = document.querySelector('.stats-section') || createElement(`
            <div class="stats-section" style="${STYLES.stats.section}">
                <style>
                    @media (max-width: 768px) {
                        .stats-flex-container {
                            flex-direction: column !important;
                        }
                        .stats-divider {
                            width: 100% !important;
                            height: 1px !important;
                            margin: 10px 0 !important;
                        }
                    }
                </style>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button class="stats-toggle" style="${STYLES.stats.toggleButton}">
                        Show Statistics ▼
                    </button>
                    <button class="settings-toggle" style="${STYLES.stats.toggleButton}">
                        Settings ⚙️
                    </button>
                </div>
                
                <!-- Settings Card -->
                <div class="settings-content" style="display: none; ${STYLES.stats.content}; margin-bottom: 15px;">
                    <h3 style="${STYLES.stats.heading}">Settings</h3>
                    <div style="${STYLES.stats.grid}">
                        ${createInputCard('API Key', 'api-key-input', false, localStorage.getItem('tornApiKey') || '')}
                        ${createInputCard('Default Rental Period (days)', 'default-rental-period', false, localStorage.getItem('defaultRentalPeriod') || '30')}
                        ${createInputCard('Default Amount ($)', 'default-rental-amount', false, localStorage.getItem('defaultRentalAmount') || '23000000')}
                        <button class="save-settings" style="${STYLES.stats.calculateButton}">
                            Save Settings 💾
                        </button>
                    </div>
                </div>

                <!-- Existing Stats Content -->
                <div class="stats-content" style="display: none; ${STYLES.stats.content}">
                    <div class="stats-flex-container" style="${STYLES.stats.flexContainer}">
                        <!-- Revenue Stats Section -->
                        <div style="${STYLES.stats.column}">
                            <h3 style="${STYLES.stats.heading}">Revenue Stats</h3>
                            <div style="${STYLES.stats.subheading}">(Based on current daily rental rates)</div>
                            <div style="${STYLES.stats.grid}">
                                ${createStatsCard('🏘️ Total Properties', 'total-properties')}
                                ${createStatsCard('💰 Daily Revenue', 'daily-revenue', '$')}
                                ${createStatsCard('📅 Monthly Revenue', 'monthly-revenue', '$')}
                                ${createStatsCard('📈 Annual Revenue', 'annual-revenue', '$')}
                            </div>
                        </div>

                        <div class="stats-divider" style="${STYLES.stats.divider}"></div>

                        <!-- ROI Calculator Section -->
                        <div style="${STYLES.stats.column}">
                            <h3 style="${STYLES.stats.heading}">ROI Calculator</h3>
                            <div style="${STYLES.stats.grid}">
                                ${createInputCard('Property Cost ($) - Default value not up to date', 'pi-cost', true, 1667000000)}
                                ${createInputCard('Daily Rent ($)', 'daily-rent', false, Math.max(...properties.map(prop => prop.costPerDay || 0)))}
                                
                                <button class="calculate-roi" style="${STYLES.stats.calculateButton}">
                                    Calculate ROI 📊
                                </button>

                                <div class="roi-result" style="${STYLES.stats.results.container}">
                                    <div style="${STYLES.stats.results.grid}">
                                        ${createStatsCard('⏱️ Days to ROI', 'days-to-roi')}
                                        ${createStatsCard('📅 Months to ROI', 'months-to-roi')}
                                        ${createStatsCard('📆 Years to ROI', 'years-to-roi')}
                                        ${createStatsCard('📈 Annual ROI', 'annual-roi', '', '%')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `);

        // Add stats section if it doesn't exist AND if pagination exists
        const paginationElement = document.querySelector('.pagination');
        if (!document.querySelector('.stats-section') && paginationElement) {
            paginationElement.insertAdjacentElement('afterend', statsSection);
            
            // Add toggle functionality
            const toggleBtn = statsSection.querySelector('.stats-toggle');
            const content = statsSection.querySelector('.stats-content');
            if (toggleBtn && content) {
                toggleBtn.addEventListener('click', () => {
                    const isVisible = content.style.display !== 'none';
                    content.style.display = isVisible ? 'none' : 'block';
                    toggleBtn.textContent = `${isVisible ? 'Show' : 'Hide'} Statistics ${isVisible ? '▼' : '▲'}`;
                });
            }

            // Add calculation functionality
            const calculateBtn = statsSection.querySelector('.calculate-roi');
            const resultDiv = statsSection.querySelector('.roi-result');
            if (calculateBtn && resultDiv) {
                calculateBtn.addEventListener('click', () => {
                    const propertyCost = parseFloat(statsSection.querySelector('.pi-cost')?.value) || 0;
                    const dailyRent = parseFloat(statsSection.querySelector('.daily-rent')?.value) || 0;
                    
                    if (propertyCost && dailyRent) {
                        const daysToRoi = Math.ceil(propertyCost / dailyRent);
                        const monthsToRoi = (daysToRoi / 30).toFixed(1);
                        const yearsToRoi = (daysToRoi / 365).toFixed(1);
                        
                        // Calculate annual ROI percentage
                        const annualReturn = (dailyRent * 365);
                        const annualRoiPercentage = ((annualReturn / propertyCost) * 100).toFixed(2);

                        resultDiv.style.display = 'block';
                        resultDiv.querySelector('.days-to-roi').textContent = daysToRoi.toLocaleString();
                        resultDiv.querySelector('.months-to-roi').textContent = monthsToRoi;
                        resultDiv.querySelector('.years-to-roi').textContent = yearsToRoi;
                        resultDiv.querySelector('.annual-roi').textContent = annualRoiPercentage;
                    }
                });
            }
        }

        // Update statistics if elements exist
        const totalPropertiesElement = document.querySelector('.total-properties');
        const dailyRevenueElement = document.querySelector('.daily-revenue');
        const monthlyRevenueElement = document.querySelector('.monthly-revenue');
        const annualRevenueElement = document.querySelector('.annual-revenue');

        if (totalPropertiesElement && dailyRevenueElement && monthlyRevenueElement && annualRevenueElement) {
            const totalProperties = properties.length;
            const dailyRevenue = properties.reduce((sum, prop) => sum + (prop.costPerDay || 0), 0);
            const monthlyRevenue = dailyRevenue * 30;
            const annualRevenue = dailyRevenue * 365;
            
            totalPropertiesElement.textContent = totalProperties;
            dailyRevenueElement.textContent = dailyRevenue.toLocaleString();
            monthlyRevenueElement.textContent = monthlyRevenue.toLocaleString();
            annualRevenueElement.textContent = annualRevenue.toLocaleString();
        }

        // Function to update filter labels with counts
        function updateFilterLabels(properties) {
            const availableCount = properties.filter(prop => prop.status === "Available").length;
            const offeredCount = properties.filter(prop => prop.offerMade).length;
            
            const hideAvailableLabel = document.getElementById('hide-available').parentElement;
            const hideOfferedLabel = document.getElementById('hide-offered').parentElement;
            
            hideAvailableLabel.innerHTML = `
                <input type="checkbox" id="hide-available" style="cursor: pointer;">
                Hide Available (${availableCount})
            `;
            hideOfferedLabel.innerHTML = `
                <input type="checkbox" id="hide-offered" style="cursor: pointer;">
                Hide Offered (${offeredCount})
            `;
            
            // Restore checkbox states
            const newAvailableCheckbox = document.getElementById('hide-available');
            const newOfferedCheckbox = document.getElementById('hide-offered');
            
            newAvailableCheckbox.checked = localStorage.getItem('hideAvailableProperties') === 'true';
            newOfferedCheckbox.checked = localStorage.getItem('hideOfferedProperties') === 'true';
            
            // Re-attach event listeners
            newAvailableCheckbox.addEventListener('change', () => {
                localStorage.setItem('hideAvailableProperties', newAvailableCheckbox.checked);
                currentPage = 1;
                displayPage(currentPage);
            });
            
            newOfferedCheckbox.addEventListener('change', () => {
                localStorage.setItem('hideOfferedProperties', newOfferedCheckbox.checked);
                currentPage = 1;
                displayPage(currentPage);
            });
        }

        // Add filter functionality
        const hideAvailable = document.getElementById('hide-available');
        const hideOffered = document.getElementById('hide-offered');
        const hideAvailableLabel = hideAvailable.parentElement;
        const hideOfferedLabel = hideOffered.parentElement;
        
        // Calculate counts
        const availableCount = properties.filter(prop => prop.status === "Available").length;
        const offeredCount = properties.filter(prop => prop.offerMade).length;
        
        // Update labels with counts
        hideAvailableLabel.innerHTML = `
            <input type="checkbox" id="hide-available" style="cursor: pointer;">
            Hide Available (${availableCount})
        `;
        hideOfferedLabel.innerHTML = `
            <input type="checkbox" id="hide-offered" style="cursor: pointer;">
            Hide Offered (${offeredCount})
        `;
        
        // Restore checkbox states
        const newAvailableCheckbox = document.getElementById('hide-available');
        const newOfferedCheckbox = document.getElementById('hide-offered');
        newAvailableCheckbox.checked = localStorage.getItem('hideAvailableProperties') === 'true';
        newOfferedCheckbox.checked = localStorage.getItem('hideOfferedProperties') === 'true';
        
        // Attach event listeners
        newAvailableCheckbox.addEventListener('change', () => {
            localStorage.setItem('hideAvailableProperties', newAvailableCheckbox.checked);
            currentPage = 1;
            displayPage(currentPage);
        });
        
        newOfferedCheckbox.addEventListener('change', () => {
            localStorage.setItem('hideOfferedProperties', newOfferedCheckbox.checked);
            currentPage = 1;
            displayPage(currentPage);
        });

        function getFilteredProperties() {
            const searchId = document.getElementById('player-id-search')?.value.trim();
            let filtered = [...properties]; // Create a copy of the properties array
            
            // Get current checkbox states directly from the elements
            const hideAvailable = document.getElementById('hide-available')?.checked;
            const hideOffered = document.getElementById('hide-offered')?.checked;
            
            if (hideAvailable) {
                filtered = filtered.filter(prop => prop.status !== "Available");
            }
            
            if (hideOffered) {
                // Explicitly check the localStorage for each property
                filtered = filtered.filter(prop => {
                    const hasOffer = localStorage.getItem(`property_offer_${prop.propertyId}`) !== null;
                    return !hasOffer;
                });
            }
            
            if (searchId) {
                filtered = filtered.filter(prop => 
                    prop.rentedBy && prop.rentedBy.toString() === searchId
                );
            }
            
            return filtered;
        }
        
        function displayPage(page) {
            const filteredProperties = getFilteredProperties();
            const totalPages = Math.ceil(filteredProperties.length / itemsPerPage);
            const start = (page - 1) * itemsPerPage;
            const end = Math.min(start + itemsPerPage, filteredProperties.length);
            const pageProperties = filteredProperties.slice(start, end);

            
            tbody.innerHTML = ''; // Clear existing rows
            
            pageProperties.forEach((prop, index) => {
                const row = document.createElement('tr');
                const displayStatus = prop.offerMade ? 'Offered' : prop.status;
                const baseColor = getPropertyRowColor(prop);
                
                row.style.cssText = `transition: background-color 0.2s ease; cursor: pointer; background-color: ${baseColor};`;
                
                // Add hover handlers
                row.addEventListener('mouseenter', () => {
                    row.style.backgroundColor = STYLES.statusColors.hover;
                });
                
                row.addEventListener('mouseleave', () => {
                    row.style.backgroundColor = baseColor;
                });

                row.innerHTML = `
                    <td style="${STYLES.tableCell}">${prop.name}</td>
                    <td style="${STYLES.tableCell}">${displayStatus}</td>
                    <td style="${STYLES.tableCell}">${prop.daysLeft}</td>
                    <td style="${STYLES.tableCell}">$${prop.costPerDay.toLocaleString()}</td>
                    <td style="${STYLES.tableCell}">
                        <a href="${prop.renew}" target="_blank" style="${STYLES.button}; text-decoration: none;">${prop.buttonValue}</a>
                    </td>
                    <td style="${STYLES.tableCell}">
                        <button class="log-offer-btn" data-property-id="${prop.propertyId}" data-days-left="${prop.daysLeft}"
                            style="${STYLES.button}"
                            ${window.innerWidth > 768 ? `title="${prop.offerMade ? 'Remove offer' : 'Log an offer'}"` : ''}>
                            ${prop.offerMade ? '❌' : '💸'}
                        </button>
                    </td>
                `;
                tbody.appendChild(row);

                // Add click handler for Log Offer button
                const logOfferBtn = row.querySelector('.log-offer-btn');
                
                const handleButtonClick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const propertyId = logOfferBtn.dataset.propertyId;
                    const daysLeft = parseInt(logOfferBtn.dataset.daysLeft);
                    
                    if (logOfferBtn.textContent.trim() === '💸') {
                        localStorage.setItem(`property_offer_${propertyId}`, daysLeft);
                        logOfferBtn.textContent = '❌';
                        logOfferBtn.title = 'Remove offer';
                    } else {
                        localStorage.removeItem(`property_offer_${propertyId}`);
                        logOfferBtn.textContent = '💸';
                        logOfferBtn.title = 'Log an offer';
                    }
                    
                    // Update the property in the current dataset
                    const property = properties.find(p => p.propertyId == propertyId);
                    if (property) {
                        property.offerMade = !property.offerMade;
                    } else {
                    }
                    
                    // Update filter labels and redisplay the page
                    updateFilterLabels(properties);
                    displayPage(currentPage);
                };

                // Add click event listener
                logOfferBtn.addEventListener('click', handleButtonClick);
            });
            
            // Update page info
            pageInfo.textContent = `Showing ${start + 1}-${end} of ${filteredProperties.length} (Page ${page} of ${totalPages})`;
            prevButton.disabled = page === 1;
            nextButton.disabled = page === totalPages;
            prevButton.style.opacity = page === 1 ? '0.5' : '1';
            nextButton.style.opacity = page === totalPages ? '0.5' : '1';
        }
        
        // Add click handlers for pagination
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                displayPage(currentPage);
            }
        });
        
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                displayPage(currentPage);
            }
        });
        
        // Display first page
        displayPage(1);

        // Add search functionality
        const searchInput = document.getElementById('player-id-search');
        const clearButton = document.getElementById('clear-search');
        
        if (searchInput && clearButton) {
            searchInput.addEventListener('input', () => {
                currentPage = 1; // Reset to first page when searching
                displayPage(currentPage);
            });

            clearButton.addEventListener('click', () => {
                searchInput.value = '';
                currentPage = 1;
                displayPage(currentPage);
            });
        }

        // Add after the stats toggle event listener:
        const settingsToggle = statsSection.querySelector('.settings-toggle');
        const settingsContent = statsSection.querySelector('.settings-content');
        const saveSettingsBtn = statsSection.querySelector('.save-settings');

        if (settingsToggle && settingsContent) {
            settingsToggle.addEventListener('click', () => {
                const isVisible = settingsContent.style.display !== 'none';
                settingsContent.style.display = isVisible ? 'none' : 'block';
                settingsToggle.textContent = `Settings ${isVisible ? '⚙️' : '▼'}`;
                
                // Hide stats content when showing settings
                if (!isVisible) {
                    statsSection.querySelector('.stats-content').style.display = 'none';
                    statsSection.querySelector('.stats-toggle').textContent = 'Show Statistics ▼';
                }
            });
        }

        if (saveSettingsBtn) {
            // Add event listener for delete API key button
            const deleteApiKeyBtn = statsSection.querySelector('.delete-api-key');
            if (deleteApiKeyBtn) {
                deleteApiKeyBtn.addEventListener('click', () => {
                    if (confirm('Are you sure you want to delete your API key?')) {
                        localStorage.removeItem('tornApiKey');
                        statsSection.querySelector('.api-key-input').value = '';
                        alert('API key deleted successfully!');
                        location.reload();
                    }
                });
            }

            saveSettingsBtn.addEventListener('click', () => {
                const apiKey = statsSection.querySelector('.api-key-input').value;
                const rentalPeriod = statsSection.querySelector('.default-rental-period').value;
                const defaultRentalAmount = statsSection.querySelector('.default-rental-amount').value;

                
                if (apiKey) {
                    localStorage.setItem('tornApiKey', apiKey);
                }
                
                if (rentalPeriod) {
                    localStorage.setItem('defaultRentalPeriod', rentalPeriod);
                }

                if (defaultRentalAmount) {
                    localStorage.setItem('defaultRentalAmount', defaultRentalAmount);
                }
                
                // Show success message
                alert('Settings saved successfully!');
                
                // Refresh the page to apply new API key if it changed
                if (apiKey !== "" && apiKey !== localStorage.getItem('tornApiKey')) {
                    location.reload();
                }
            });
        }

        // Store the days left for each property in localStorage
        const propertyDaysLeft = {};
        properties.forEach(prop => {
            propertyDaysLeft[prop.propertyId] = prop.daysLeft;
        });
        localStorage.setItem('propertyDaysLeft', JSON.stringify(propertyDaysLeft));
    }

    function getPropertyDaysLeft(propertyId) {
        // Try to get from localStorage first
        const storedData = localStorage.getItem('propertyDaysLeft');
        if (storedData) {
            try {
                const propertyData = JSON.parse(storedData);
                return propertyData[propertyId] || 0;
            } catch (e) {
                console.error('Error parsing propertyDaysLeft data:', e);
                return 0;
            }
        }
        return 0;
    }

    // Add new function to observe offer submissions
    function observeOfferSubmissions() {
        const url = new URL(window.location.href);
        if (url.hash.includes('tab=offerExtension') || url.hash.includes('tab=lease')) {
            const propertyId = url.hash.match(/ID=(\d+)/)?.[1];
            if (!propertyId) return;

            console.log('Observing for offer submissions on property:', propertyId);

            const daysLeft = getPropertyDaysLeft(propertyId);
            console.log('Days left for property', propertyId, ':', daysLeft);

            const observer = new MutationObserver((mutations, obs) => {
                const nextButton = document.querySelector('input[type="submit"][value="NEXT"]');
                const offerExtensionUl = document.querySelector('ul.offerExtension-input');
                
                if (offerExtensionUl) {
                    const costLi = offerExtensionUl.querySelector('li.cost');
                    const amountLi = offerExtensionUl.querySelector('li.amount');
                    
                    if (costLi && amountLi && !costLi.dataset.listenerAttached) {
                        console.log('Found form elements, setting default values...');
                        
                        // Get default values from localStorage
                        const defaultPeriod = parseInt(localStorage.getItem('defaultRentalPeriod')) || 30;
                        const defaultAmount = parseInt(localStorage.getItem('defaultRentalAmount')) || 23000000;
                        
                        // Only run if we haven't processed these inputs yet
                        if (!costLi.dataset.processed) {
                            setTimeout(() => {
                                // Set the cost inputs - use more specific selector
                                const costInputs = costLi.querySelectorAll('input.offerExtension.input-money:not([data-processed])');
                                console.log('Found cost inputs:', costInputs.length);
                                costInputs.forEach(input => {
                                    if (!input.dataset.processed) {
                                        console.log('Setting input value to:', defaultAmount);
                                        input.value = defaultAmount;
                                        input.dispatchEvent(new Event('input', { bubbles: true }));
                                        input.dispatchEvent(new Event('change', { bubbles: true }));
                                        input.dispatchEvent(new Event('blur', { bubbles: true }));
                                        input.dispatchEvent(new Event('focus', { bubbles: true }));
                                        input.dataset.processed = 'true';
                                    }
                                });

                                // Set the amount input - use more specific selector
                                const amountInput = amountLi.querySelector('input.input-money:not([data-processed])');
                                if (amountInput && !amountInput.dataset.processed) {
                                    console.log('Setting amount to', defaultPeriod, 'days');
                                    amountInput.value = defaultPeriod.toString();
                                    amountInput.dispatchEvent(new Event('input', { bubbles: true }));
                                    amountInput.dispatchEvent(new Event('change', { bubbles: true }));
                                    amountInput.dispatchEvent(new Event('blur', { bubbles: true }));
                                    amountInput.dispatchEvent(new Event('focus', { bubbles: true }));
                                    amountInput.dataset.processed = 'true';
                                }
                                
                                // Mark the container as processed
                                costLi.dataset.processed = 'true';
                                
                                // Only disconnect if both inputs are processed
                                if (costLi.dataset.processed && amountInput?.dataset.processed) {
                                    observer.disconnect();
                                }
                            }, 500);
                        }
                        
                        costLi.dataset.listenerAttached = 'true';
                    }
                }
                
                if (nextButton && !nextButton.dataset.listenerAttached) {
                    console.log('Found next button');
                    nextButton.dataset.listenerAttached = 'true';
                    nextButton.addEventListener('click', () => {
                        console.log('Next button clicked - storing offer with days left:', daysLeft);
                        localStorage.setItem(`property_offer_${propertyId}`, daysLeft.toString());
                    });
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                characterData: true
            });
        }
    }

    // Initialize the script
    window.addEventListener('load', function() {
        let attempts = 0;
        
        const checkForElement = setInterval(() => {
            attempts++;
            const targetElement = getElement('#properties-page-wrap');
            
            if (targetElement) {
                clearInterval(checkForElement);
                createPropertiesTable();
                getUserId();
                observeOfferSubmissions();
                setupNavigationObserver();
            } else if (attempts >= CONFIG.MAX_RETRIES) {
                clearInterval(checkForElement);
                console.error('Properties Manager: Failed to initialize');
            }
        }, CONFIG.RETRY_DELAY);
    });

    // Listen for URL changes (for single-page app navigation)
    window.addEventListener('hashchange', observeOfferSubmissions);

    function createStatsCard(label, className, prefix = '', suffix = '') {
        return `
            <div style="${STYLES.stats.card}">
                <div style="${STYLES.stats.cardLabel}">${label}</div>
                <div style="${STYLES.stats.cardValue}">
                    ${prefix}<span class="${className}">-</span>${suffix}
                </div>
            </div>
        `;
    }

    function getUserId() {
        const apiKey = localStorage.getItem('tornApiKey');
        if (!apiKey) return;

        // Only fetch once per minute (60000 milliseconds)
        const now = Date.now();
        const lastFetched = localStorage.getItem('propertyId_lastFetched');
        if (lastFetched && (now - parseInt(lastFetched) < 60000)) {
            return Promise.resolve(localStorage.getItem('property_currentUserId'));
        }

        return fetch(`https://api.torn.com/v2/user?key=${apiKey}&selections=profile`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    throw new Error(`API Error: ${data.error.error}`);
                }
                localStorage.setItem('property_currentUserId', data.player_id);
                localStorage.setItem('propertyId_lastFetched', now.toString());
                return data.player_id;
            })
            .catch(handleApiError);
    }

    function createInputCard(label, className, hasSearchButton = false, defaultValue = '') {
        const inputStyle = hasSearchButton ? STYLES.stats.input.fieldLeft : STYLES.stats.input.fieldFull;
        const valueAttr = defaultValue ? `value="${defaultValue}"` : '';
        
        // Add delete button for API key
        const deleteButton = className === 'api-key-input' ? `
            <button class="delete-api-key" 
                    style="${STYLES.stats.input.button}; background: #662222; margin-left: 5px;" 
                    title="Delete API Key">
                🗑️
            </button>
        ` : '';
        
        return `
            <div style="${STYLES.stats.card}">
                <div style="${STYLES.stats.cardLabel}">${label}</div>
                <div style="${STYLES.stats.input.container}">
                    <input type="${className === 'api-key-input' ? 'text' : 'number'}" class="${className}" 
                        style="${STYLES.stats.input.field} ${inputStyle}"
                        placeholder="Enter ${label.toLowerCase()}"
                        ${valueAttr}>
                    ${hasSearchButton ? `
                        <a href="https://www.torn.com/properties.php?step=sellingmarket#/property=13" 
                           target="_blank" 
                           style="${STYLES.stats.input.button}">🔍</a>
                    ` : ''}
                    ${deleteButton}
                </div>
            </div>
        `;
    }
})();