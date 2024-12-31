// ==UserScript==
// @name         Torn Properties Manager
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Inserts a properties table on Torn's properties page
// @author       You
// @match        https://www.torn.com/properties.php*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function createPropertiesTable() {
        const tableHTML = `
            <div class="properties-container" style="margin: 20px; background: #2d2d2d; padding: 15px; border-radius: 5px;">
                <div class="properties-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; cursor: pointer;">
                    <h2 style="color: #fff; margin: 0;">Properties Manager</h2>
                    <span class="collapse-icon" style="color: #fff; font-size: 20px;">▶</span>
                </div>
                <div class="properties-content" style="display: none;">
                    <div style="margin-bottom: 15px; text-align: right;">
                        <button id="refresh-properties" style="background: #444; color: #fff; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Refresh</button>
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
                        <button id="prev-page" style="background: #444; color: #fff; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Previous</button>
                        <button id="next-page" style="background: #444; color: #fff; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Next</button>
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


function getPropertyData() {
    // Get API key from storage or prompt user
    const apiKey = localStorage.getItem('tornApiKey') || prompt('Please enter your Torn API key:');
    
    if (apiKey) {
        // Store the API key for future use
        localStorage.setItem('tornApiKey', apiKey);
        
        // Fetch data from Torn API
        fetch(`https://api.torn.com/v2/user?key=${apiKey}&selections=properties&stat=rented&sort=ASC`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    throw new Error(`API Error: ${data.error.error}`);
                }
                
                // Transform API data and check localStorage for offers
                const properties = Object.entries(data.properties)
                    .filter(([_, prop]) => 
                        prop.status !== "Owned by their spouse" && 
                        !(prop.rented === null && prop.upkeep > 0)
                    )
                    .map(([id, prop]) => {
                        const offerMade = localStorage.getItem(`property_offer_${id}`);
                        return {
                            propertyId: id,
                            name: prop.property,
                            status: prop.rented ? "Rented" : "Available",
                            daysLeft: prop.rented ? prop.rented.days_left : 0,
                            renew: 'https://www.torn.com/properties.php#/p=options&ID=' + id + '&tab=offerExtension',
                            offerMade: offerMade ? new Date(offerMade).toLocaleDateString() : null
                        };
                    })
                    .sort((a, b) => a.daysLeft - b.daysLeft);
                
                updateTable(properties);
            })
            .catch(error => {
                console.error('Error fetching property data:', error);
                alert('Error fetching property data. Please check your API key and try again.');
            });
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
        
        function displayPage(page) {
            const start = (page - 1) * itemsPerPage;
            const end = Math.min(start + itemsPerPage, properties.length);
            const pageProperties = properties.slice(start, end);
            
            tbody.innerHTML = ''; // Clear existing rows
            
            pageProperties.forEach(prop => {
                const row = document.createElement('tr');
                const displayStatus = prop.offerMade ? 'Offered' : prop.status;
                
                // Add background color based on days left or offer status
                const daysLeft = parseInt(prop.daysLeft);
                let rowStyle = '';
                if (prop.offerMade) {
                    rowStyle = 'background-color: rgba(0, 255, 0, 0.1);'; // subtle green for offered properties
                } else if (daysLeft === 0) {
                    rowStyle = 'background-color: rgba(255, 0, 0, 0.1);'; // subtle red for 0 days
                } else if (daysLeft <= 10) {
                    rowStyle = 'background-color: rgba(255, 165, 0, 0.1);'; // subtle orange for 1-10 days
                }
                
                // Add hover transition and cursor style
                row.style.cssText = 'transition: background-color 0.2s ease; cursor: pointer;';
                
                // Add hover effect with JavaScript
                row.addEventListener('mouseenter', () => {
                    row.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; // subtle white overlay on hover
                });
                
                row.addEventListener('mouseleave', () => {
                    // Return to original background color
                    if (prop.offerMade) {
                        row.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
                    } else if (daysLeft === 0) {
                        row.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
                    } else if (daysLeft <= 10) {
                        row.style.backgroundColor = 'rgba(255, 165, 0, 0.1)';
                    } else {
                        row.style.backgroundColor = '';
                    }
                });

                row.innerHTML = `
                    <td style="padding: 8px; border-bottom: 1px solid #444; color: #fff; ${rowStyle}">${prop.propertyId}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #444; color: #fff; ${rowStyle}">${prop.name}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #444; color: #fff; ${rowStyle}">${displayStatus}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #444; color: #fff; ${rowStyle}">${prop.daysLeft}</td>
                    <td style="padding: 8px; border-bottom: 1px solid #444; color: #fff; ${rowStyle}">
                        <a href="${prop.renew}" target="_blank" style="color: #fff; text-decoration: none; background: #444; padding: 4px 8px; border-radius: 3px; display: inline-block; transition: background 0.2s;">Renew</a>
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
        // Check if we're on an offer extension page
        const url = new URL(window.location.href);
        if (url.hash.includes('tab=offerExtension')) {
            const propertyId = url.hash.match(/ID=(\d+)/)?.[1];
            if (!propertyId) return;

            console.log('Observing for offer submissions on property:', propertyId);

            // Watch for the "NEXT" input
            const observer = new MutationObserver((mutations, obs) => {
                const nextButton = document.querySelector('input[type="submit"][value="NEXT"]');
                
                if (nextButton && !nextButton.dataset.listenerAttached) {
                    console.log('Found next button');
                    nextButton.dataset.listenerAttached = 'true';
                    nextButton.addEventListener('click', () => {
                        console.log('Next button clicked');
                        localStorage.setItem(`property_offer_${propertyId}`, new Date().toISOString());
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