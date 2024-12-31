// ==UserScript==
// @name         Torn Properties Manager
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Inserts a properties table on Torn's properties page
// @author       beans_ [174079]
// @match        https://www.torn.com/properties.php*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Constants for styling
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

    function createPropertiesTable() {
        const tableHTML = `
            <div class="properties-container" style="${STYLES.container}">
                <div class="properties-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; cursor: pointer;">
                    <h2 style="color: #fff; margin: 0;">Properties Manager</h2>
                    <span class="collapse-icon" style="color: #fff; font-size: 20px;">▶</span>
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

        const targetElement = document.querySelector('.content-wrapper');
        if (targetElement) {
            targetElement.insertAdjacentHTML('afterbegin', tableHTML);
            
            // Add variable declarations at the top
            const header = document.querySelector('.properties-header');
            const content = document.querySelector('.properties-content');
            const icon = document.querySelector('.collapse-icon');
            const refreshButton = document.getElementById('refresh-properties');
            let dataFetched = false;
            let lastRefreshTime = 0;
            
            header.addEventListener('click', (e) => {
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
        const apiKey = localStorage.getItem('tornApiKey') || prompt('Please enter your Torn API key:');
        
        if (!apiKey) return;
        
        localStorage.setItem('tornApiKey', apiKey);
        
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
                    .filter(([_, prop]) => 
                        prop.status !== "Owned by their spouse" && 
                        !(prop.rented === null && prop.upkeep > 0)
                    )
                    .map(([id, prop]) => ({
                        propertyId: id,
                        name: prop.property,
                        status: prop.rented ? "Rented" : "Available",
                        daysLeft: prop.rented ? prop.rented.days_left : 0,
                        renew: `https://www.torn.com/properties.php#/p=options&ID=${id}&tab=offerExtension`,
                        offerMade: localStorage.getItem(`property_offer_${id}`) || null
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
                        <a href="${prop.renew}" target="_blank" style="${STYLES.button}; text-decoration: none;">Renew</a>
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
                const nextButton = document.querySelector('input[type="submit"][value="SEND OFFER"]');
                
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

    // Wait for page load and insert table
    window.addEventListener('load', function() {
        createPropertiesTable();
        getPropertyData();
        observeOfferSubmissions();
    });

    // Listen for URL changes (for single-page app navigation)
    window.addEventListener('hashchange', observeOfferSubmissions);
})();