// ==UserScript==
// @name         Torn Properties Manager
// @namespace    http://tampermonkey.net/
// @version      2.1
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
        }
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
    async function fetchAPI(endpoint, options = {}) {
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
    }

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

    // Optimize property data processing
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
                offerMade: localStorage.getItem(`property_offer_${id}`) || null,
                costPerDay: prop.rented ? prop.rented.cost_per_day : 0,
                buttonValue: prop.rented ? "Renew" : "Lease"
            }))
            .sort((a, b) => a.daysLeft - b.daysLeft);
    }

    // Optimize table updates with DocumentFragment
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

    // Optimize observers with weak references
    function setupNavigationObserver() {
        const observer = new MutationObserver(
            debounce((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'childList' && 
                        mutation.target.id === 'properties-page-wrap') {
                        createPropertiesTable();
                        getCurrentPropertyId();
                        observeOfferSubmissions();
                        break;
                    }
                }
            }, 100)
        );

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Creates a styled button element
     * @param {string} text - Button text
     * @param {string} id - Button ID
     * @returns {string} HTML button string
     */
    function createButton(text, id) {
        return `<button id="${id}" style="${STYLES.button}">${text}</button>`;
    }

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

    function createApiKeyForm() {
        return `
            <div class="properties-container" style="${STYLES.container}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h2 style="color: #fff; margin: 0;">Properties Manager</h2>
                </div>
                <div style="text-align: center;">
                    <p style="color: #fff; margin-bottom: 15px;">Please enter your Torn API key to continue:</p>
                    <input type="text" id="torn-api-key" style="padding: 5px; margin-right: 10px; background: #444; color: #fff; border: 1px solid #666; border-radius: 3px;">
                    <button id="submit-api-key" style="${STYLES.button}">Submit</button>
                </div>
            </div>`;
    }

    function createPropertiesTable() {
        // Check if container already exists
        if (document.querySelector('.properties-container')) {
            return;
        }

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
            <div class="properties-container" style="${STYLES.container}">
                <div class="properties-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h2 style="color: #fff; margin: 0; cursor: pointer;">Properties Manager</h2>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="collapse-icon" style="color: #fff; font-size: 20px; cursor: pointer;">▶</span>
                    </div>
                </div>
                <div class="properties-content" style="display: none;">
                    <div style="margin-bottom: 15px; text-align: right;">
                        <button id="refresh-properties" style="${STYLES.button}">Refresh</button>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; color: #fff;">
                        <thead>
                            <tr>
                                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #444; font-weight: bold;">Property ID</th>
                                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #444; font-weight: bold;">Property Name</th>
                                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #444; font-weight: bold;">Status</th>
                                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #444; font-weight: bold;">Days Left</th>
                                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #444; font-weight: bold;">Renew</th>
                            </tr>
                        </thead>
                        <tbody id="properties-table-body">
                        </tbody>
                    </table>
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
        const message = error.message.includes('API Error') 
            ? error.message 
            : 'Error fetching property data. Please check your API key and try again.';
        alert(message);
    }

    function getPropertyData() {
        const apiKey = localStorage.getItem('tornApiKey');
        const currentPropertyId = localStorage.getItem('currentPropertyId');
        if (!apiKey) {
            // The table shouldn't exist without an API key now
            return;
        }
        
        fetch(`https://api.torn.com/v2/user?key=${apiKey}&selections=properties&stat=rented&sort=ASC`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    throw new Error(`API Error: ${data.error.error}`);
                }
                
                if (!data.properties) {
                    throw new Error('Invalid API response: missing properties data');
                }
                
                // Check and clean up localStorage before processing properties
                Object.entries(data.properties).forEach(([id, prop]) => {
                    const storedDaysLeft = localStorage.getItem(`property_offer_${id}`);
                    if (storedDaysLeft && (
                        (prop.rented && prop.rented.days_left > parseInt(storedDaysLeft)) || // Renewal successful
                        (prop.rented && prop.rented.days_left === 0) || // Rental expired
                        (!prop.rented) // Property no longer rented
                    )) {
                        localStorage.removeItem(`property_offer_${id}`);
                    }
                });
                
                const properties = Object.entries(data.properties)
                    .filter(([id, prop]) => 
                        prop.status !== "Owned by their spouse" && 
                        id !== currentPropertyId
                    )
                    .map(([id, prop]) => ({
                        propertyId: id,
                        name: prop.property,
                        status: prop.rented ? "Rented" : "Available",
                        daysLeft: prop.rented ? prop.rented.days_left : 0,
                        renew: prop.rented ?`https://www.torn.com/properties.php#/p=options&ID=${id}&tab=offerExtension` : `https://www.torn.com/properties.php#/p=options&ID=${id}&tab=lease`,
                        offerMade: localStorage.getItem(`property_offer_${id}`) || null,
                        costPerDay: prop.rented ? prop.rented.cost_per_day : 0,
                        buttonValue: prop.rented ? "Renew" : "Lease"
                    }))
                    .sort((a, b) => a.daysLeft - b.daysLeft);
                
                updateTable(properties);
                
                // Store the days left for each property
                properties.forEach(prop => {
                    window.propertyDaysLeft = window.propertyDaysLeft || {};
                    window.propertyDaysLeft[prop.propertyId] = prop.daysLeft;
                });
            })
            .catch(handleApiError);
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
            <div class="stats-section" style="margin-top: 15px; text-align: center;">
                <button class="stats-toggle" style="background: #444; color: #fff; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">
                    Show Statistics ▼
                </button>
                <div class="stats-content" style="display: none; margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 4px; text-align: left;">
                    <div style="display: flex; gap: 20px;">
                        <!-- Revenue Stats Section -->
                        <div style="flex: 1;">
                            <h3 style="color: #fff; margin: 0 0 10px 0;">Revenue Stats</h3>
                            <div style="color: #fff; margin: 5px 0;">
                                Total Properties: <span class="total-properties">0</span>
                            </div>
                            <div style="color: #fff; margin: 5px 0;">
                                Daily Revenue: $<span class="daily-revenue">0</span>
                            </div>
                            <div style="color: #fff; margin: 5px 0;">
                                Monthly Revenue: $<span class="monthly-revenue">0</span>
                            </div>
                            <div style="color: #fff; margin: 5px 0;">
                                Annual Revenue: $<span class="annual-revenue">0</span>
                            </div>
                        </div>

                        <!-- Vertical Divider -->
                        <div style="width: 1px; background: #444;"></div>

                        <!-- ROI Calculator Section -->
                        <div style="flex: 1;">
                            <h3 style="color: #fff; margin: 0 0 10px 0;">ROI Calculator</h3>
                            <div style="color: #fff; margin: 10px 0;">
                                <label style="display: block; margin-bottom: 5px;">Property Cost ($):</label>
                                <div style="display: flex;">
                                    <input type="number" class="pi-cost" style="flex: 1; padding: 5px; background: #444; color: #fff; border: 1px solid #666; border-radius: 3px 0 0 3px; border-right: none;" placeholder="Enter property cost">
                                    <a href="https://www.torn.com/properties.php?step=sellingmarket#/property=13" target="_blank" style="background: #444; color: #fff; border: 1px solid #666; border-radius: 0 3px 3px 0; padding: 5px 10px; text-decoration: none; display: flex; align-items: center;">🔍</a>
                                </div>
                            </div>
                            <div style="color: #fff; margin: 10px 0;">
                                <label style="display: block; margin-bottom: 5px;">Daily Rent ($):</label>
                                <input type="number" class="daily-rent" style="width: calc(100% - 10px); padding: 5px; background: #444; color: #fff; border: 1px solid #666; border-radius: 3px;" placeholder="Enter daily rent" value="${Math.max(...properties.map(prop => prop.costPerDay || 0))}">
                            </div>
                            <button class="calculate-roi" style="background: #444; color: #fff; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; width: 100%; margin-top: 10px;">Calculate ROI</button>
                            <div class="roi-result" style="color: #fff; margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 4px; display: none;">
                                <div>Days to ROI: <span class="days-to-roi">-</span></div>
                                <div>Months to ROI: <span class="months-to-roi">-</span></div>
                                <div>Years to ROI: <span class="years-to-roi">-</span></div>
                                <div><strong>ROI @365 days: <span class="annual-roi">-</span>%</strong></div>
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

        function displayPage(page) {
            const start = (page - 1) * itemsPerPage;
            const end = Math.min(start + itemsPerPage, properties.length);
            const pageProperties = properties.slice(start, end);
            
            tbody.innerHTML = ''; // Clear existing rows
            
            pageProperties.forEach(prop => {
                const row = document.createElement('tr');
                const displayStatus = prop.offerMade ? 'Offered' : prop.status;
                const baseColor = getPropertyRowColor(prop);
                
                row.style.cssText = `transition: background-color 0.2s ease; cursor: pointer; background-color: ${baseColor};`;
                
                // Simplified hover handlers
                row.addEventListener('mouseenter', () => {
                    row.style.backgroundColor = STYLES.statusColors.hover;
                });
                
                row.addEventListener('mouseleave', () => {
                    row.style.backgroundColor = baseColor;
                });

                row.innerHTML = `
                    <td style="${STYLES.tableCell}">${prop.propertyId}</td>
                    <td style="${STYLES.tableCell}">${prop.name}</td>
                    <td style="${STYLES.tableCell}">${displayStatus}</td>
                    <td style="${STYLES.tableCell}">${prop.daysLeft}</td>
                    <td style="${STYLES.tableCell}">
                        <a href="${prop.renew}" target="_blank" style="${STYLES.button}; text-decoration: none;">${prop.buttonValue}</a>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            // Update page info with row count
            pageInfo.textContent = `Showing ${start + 1}-${end} of ${properties.length} (Page ${page} of ${totalPages})`;
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
    }

    // Add new function to observe offer submissions
    function observeOfferSubmissions() {
        const url = new URL(window.location.href);
        if (url.hash.includes('tab=offerExtension')) {
            const propertyId = url.hash.match(/ID=(\d+)/)?.[1];
            if (!propertyId) return;

            console.log('Observing for offer submissions on property:', propertyId);

            const observer = new MutationObserver((mutations, obs) => {
                const nextButton = document.querySelector('input[type="submit"][value="NEXT"]');
                
                if (nextButton && !nextButton.dataset.listenerAttached) {
                    console.log('Found next button');
                    nextButton.dataset.listenerAttached = 'true';
                    nextButton.addEventListener('click', () => {
                        console.log('Next button clicked');
                        // Store the days left instead of the date
                        const daysLeft = window.propertyDaysLeft?.[propertyId] || 0;
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

    // Add this new function after the other API-related functions
    function getCurrentPropertyId() {
        const apiKey = localStorage.getItem('tornApiKey');
        if (!apiKey) return;

        // Only fetch once per minute (60000 milliseconds)
        const now = Date.now();
        const lastFetched = localStorage.getItem('propertyId_lastFetched');
        if (lastFetched && (now - parseInt(lastFetched) < 60000)) {
            return Promise.resolve(localStorage.getItem('currentPropertyId'));
        }

        return fetch(`https://api.torn.com/v2/user?key=${apiKey}&selections=profile`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    throw new Error(`API Error: ${data.error.error}`);
                }
                localStorage.setItem('currentPropertyId', data.property_id);
                localStorage.setItem('propertyId_lastFetched', now.toString());
                return data.property_id;
            })
            .catch(handleApiError);
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
                getCurrentPropertyId();
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
})();