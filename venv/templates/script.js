document.addEventListener('DOMContentLoaded', function() {
    // Play lock sound on page load
    const lockSound = document.getElementById('lock-sound');
    
    // Add a slight delay to ensure better user experience
    setTimeout(() => {
        if (lockSound) {
            lockSound.volume = 0.5; // Set volume to 50%
            lockSound.play().catch(e => {
                console.log('Auto-play prevented by browser:', e);
            });
        }
        
        // Add lock animation class to header
        document.querySelector('header').classList.add('lock-animation');
        
        // Animate background logo
        gsap.from('#background-logo', {
            opacity: 0,
            scale: 1.5,
            duration: 2,
            ease: "power3.out"
        });
    }, 300);
    
    // Initialize particles.js
    particlesJS('particles-js', {
        "particles": {
            "number": {
                "value": 50,
                "density": {
                    "enable": true,
                    "value_area": 800
                }
            },
            "color": {
                "value": "#9945FF"
            },
            "shape": {
                "type": "circle",
                "stroke": {
                    "width": 0,
                    "color": "#000000"
                }
            },
            "opacity": {
                "value": 0.2,
                "random": true,
                "anim": {
                    "enable": true,
                    "speed": 0.5,
                    "opacity_min": 0.1,
                    "sync": false
                }
            },
            "size": {
                "value": 3,
                "random": true,
                "anim": {
                    "enable": true,
                    "speed": 2,
                    "size_min": 0.1,
                    "sync": false
                }
            },
            "line_linked": {
                "enable": true,
                "distance": 150,
                "color": "#14F195",
                "opacity": 0.2,
                "width": 1
            },
            "move": {
                "enable": true,
                "speed": 0.8,
                "direction": "none",
                "random": true,
                "straight": false,
                "out_mode": "out",
                "bounce": false,
                "attract": {
                    "enable": true,
                    "rotateX": 600,
                    "rotateY": 1200
                }
            }
        },
        "interactivity": {
            "detect_on": "canvas",
            "events": {
                "onhover": {
                    "enable": true,
                    "mode": "grab"
                },
                "onclick": {
                    "enable": true,
                    "mode": "push"
                },
                "resize": true
            },
            "modes": {
                "grab": {
                    "distance": 140,
                    "line_linked": {
                        "opacity": 0.6
                    }
                },
                "push": {
                    "particles_nb": 3
                }
            }
        },
        "retina_detect": true
    });
    
    // Initialize GSAP animations for UI elements
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    
    tl.from('header', { y: -50, opacity: 0, duration: 0.8 })
      .from('.card', { y: 30, opacity: 0, duration: 0.8, stagger: 0.2 }, "-=0.4")
      .from('.solana-gradient', { 
          textShadow: "0 0 0 rgba(153, 69, 255, 0)",
          opacity: 0.5,
          duration: 1.5
      }, "-=0.6");
    
    // Configuration
    const API_URL = 'ws://localhost:8000/ws';
    let SOL_USD_PRICE = 111.45; // Initial price, will be updated with real data
    
    // Elements
    const addressesList = document.getElementById('addresses-list');
    const addressCount = document.getElementById('address-count');
    const addressSearch = document.getElementById('address-search');
    const scanBtn = document.getElementById('scan-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const addressDetails = document.getElementById('address-details');
    const noAddressSelected = document.getElementById('no-address-selected');
    const loadingProgress = document.getElementById('loading-progress');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const loadingStatus = document.getElementById('loading-status');
    const selectedAddress = document.getElementById('selected-address');
    const solBalance = document.getElementById('sol-balance');
    const usdBalance = document.getElementById('usd-balance');
    const totalPortfolioValue = document.getElementById('total-portfolio-value');
    const solscanLink = document.getElementById('solscan-link');
    const lastUpdated = document.getElementById('last-updated');
    const transactionsList = document.getElementById('transactions-list');
    const portfolioList = document.getElementById('portfolio-list');
    const connectionStatus = document.getElementById('connection-status');
    const sortOptions = document.getElementById('sort-options');
    const chartLoading = document.getElementById('chart-loading');
    const portfolioChart = document.getElementById('portfolio-chart');
    const historyLoading = document.getElementById('history-loading');
    const historyChart = document.getElementById('history-chart');
    const nftSection = document.getElementById('nft-section');
    const nftGallery = document.getElementById('nft-gallery');
    
    // Security elements
    const securityBadge = document.getElementById('security-badge');
    const riskScore = document.getElementById('risk-score');
    const riskMeterIndicator = document.getElementById('risk-meter-indicator');
    const securityIssuesContainer = document.getElementById('security-issues-container');
    const noSecurityIssues = document.getElementById('no-security-issues');
    
    // Chart instances
    let portfolioChartInstance = null;
    let historyChartInstance = null;
    
    // State
    let addresses = [];
    let selectedAddressData = null;
    let ws = null;
    
    // Connect to WebSocket
    function connectWebSocket() {
        ws = new WebSocket(API_URL);
        
        ws.onopen = function() {
            console.log('Connected to server');
            connectionStatus.textContent = 'Connected';
            document.querySelector('.activity-dot').classList.add('active');
            
            // Play a soft connection sound
            const connectionSound = new Audio('https://assets.mixkit.co/active_storage/sfx/1111/1111-preview.mp3');
            connectionSound.volume = 0.2;
            connectionSound.play().catch(e => console.log('Sound play prevented:', e));
            
            // Animate the connection status with GSAP
            gsap.fromTo(connectionStatus.parentElement, 
                {scale: 0.9, opacity: 0.7}, 
                {scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.7)"}
            );
        };
        
        ws.onmessage = function(event) {
            const message = JSON.parse(event.data);
            
            switch(message.type) {
                case 'full_update':
                    addresses = message.data;
                    renderAddressList();
                    addressCount.textContent = `${addresses.length} Addresses`;
                    
                    // Animate new content
                    gsap.fromTo('#addresses-list .address-card', 
                        {y: 20, opacity: 0}, 
                        {y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: "power2.out"}
                    );
                    break;
                    
                case 'account_update':
                    updateAddress(message.data);
                    break;
            }
        };
        
        ws.onclose = function() {
            console.log('Disconnected from server');
            connectionStatus.textContent = 'Disconnected';
            document.querySelector('.activity-dot').classList.remove('active');
            
            // Indicate connection loss visually
            gsap.to(connectionStatus.parentElement, {
                backgroundColor: 'rgba(255, 94, 94, 0.2)',
                borderColor: 'rgba(255, 94, 94, 0.3)',
                yoyo: true,
                repeat: 3,
                duration: 0.3
            });
            
            // Try to reconnect after a delay
            setTimeout(connectWebSocket, 5000);
        };
        
        ws.onerror = function(error) {
            console.error('WebSocket error:', error);
            connectionStatus.textContent = 'Connection Error';
            document.querySelector('.activity-dot').classList.remove('active');
        };
    }
    
    // Initialize connection
    connectWebSocket();
    
    // Render the list of addresses
    function renderAddressList() {
        addressesList.innerHTML = '';
        
        if (addresses.length === 0) {
            addressesList.innerHTML = `
                <div class="text-center text-gray-500 py-8 fade-in">
                    <i class="fas fa-search text-4xl mb-3"></i>
                    <p>No addresses found</p>
                </div>`;
            return;
        }
        
        // Sort addresses by balance (highest first)
        addresses.sort((a, b) => b.balance - a.balance);
        
        addresses.forEach((address, index) => {
            const template = document.getElementById('address-card-template');
            const clone = template.content.cloneNode(true);
            
            const card = clone.querySelector('.address-card');
            card.dataset.address = address.address;
            
            // Add animation delay for staggered entrance
            card.style.animationDelay = `${index * 50}ms`;
            
            const addressText = clone.querySelector('.address-text');
            addressText.textContent = formatAddress(address.address);
            
            const balance = clone.querySelector('.balance');
            balance.textContent = `${address.balance.toFixed(2)} SOL`;
            
            const usdValue = clone.querySelector('.usd-value');
            usdValue.textContent = `≈ ${(address.balance * SOL_USD_PRICE).toFixed(2)} USD`;
            
            const txCount = clone.querySelector('.transaction-count');
            txCount.textContent = `${address.recentTransactions?.length || 0} txns`;
            
            const lastActivity = clone.querySelector('.last-activity');
            if (address.recentTransactions?.length > 0) {
                lastActivity.textContent = `Last activity: ${formatTimeAgo(address.recentTransactions[0].blockTime)}`;
            } else {
                lastActivity.textContent = 'No recent activity';
            }
            
            // Add security status indicator if available
            const securityStatus = clone.querySelector('.security-status');
            if (address.security) {
                let statusClass = 'security-secure';
                let icon = 'shield-check';
                
                if (address.security.status === 'warning') {
                    statusClass = 'security-warning';
                    icon = 'exclamation-triangle';
                } else if (address.security.status === 'critical') {
                    statusClass = 'security-critical';
                    icon = 'exclamation-circle';
                }
                
                securityStatus.innerHTML = `
                    <span class="security-badge ${statusClass} text-xs">
                        <i class="fas fa-${icon} mr-1"></i>
                        ${address.security.status === 'secure' ? 'Secure' : 
                          address.security.status === 'warning' ? 'Warning' : 'Critical'}
                    </span>
                `;
            }
            
            addressesList.appendChild(clone);
        });
        
        // Add click event listeners to the cards
        document.querySelectorAll('.address-card').forEach(card => {
            card.addEventListener('click', () => {
                selectAddress(card.dataset.address);
                
                // Play a subtle selection sound
                const selectSound = new Audio('https://assets.mixkit.co/active_storage/sfx/146/146-preview.mp3');
                selectSound.volume = 0.2;
                selectSound.play().catch(e => console.log('Sound play prevented:', e));
            });
        });
    }
    
    // Update a single address in the list
    function updateAddress(updatedAddress) {
        const index = addresses.findIndex(a => a.address === updatedAddress.address);
        
        if (index !== -1) {
            addresses[index] = updatedAddress;
        } else {
            addresses.push(updatedAddress);
        }
        
        renderAddressList();
        addressCount.textContent = `${addresses.length} Addresses`;
        
        // Animate the counter for visual feedback
        gsap.fromTo(addressCount, 
            {scale: 1.1, color: "rgba(20, 241, 149, 1)"},
            {scale: 1, color: "rgba(241, 241, 242, 1)", duration: 0.5, ease: "power2.out"}
        );
        
        // Update selected address details if needed
        if (selectedAddressData && selectedAddressData.address === updatedAddress.address) {
            selectedAddressData = updatedAddress;
            
            // Update loading progress if available
            if (updatedAddress.loadingStage) {
                updateLoadingProgress(updatedAddress.loadingStage);
            }
            
            renderAddressDetails();
        }
    }
    
    // Update loading progress
    function updateLoadingProgress(stage) {
        loadingProgress.classList.remove('hidden');
        
        let progress = 25;
        let statusText = 'Basic info';
        
        switch(stage) {
            case 'basic_info':
                progress = 25;
                statusText = 'Basic info';
                break;
            case 'transactions':
                progress = 50;
                statusText = 'Transactions';
                break;
            case 'tokens':
                progress = 75;
                statusText = 'Token balances';
                break;
            case 'complete':
                progress = 100;
                statusText = 'Complete!';
                
                // Play complete sound
                const completeSound = new Audio('https://assets.mixkit.co/active_storage/sfx/650/650-preview.mp3');
                completeSound.volume = 0.2;
                completeSound.play().catch(e => console.log('Sound play prevented:', e));
                
                // Animate completion
                gsap.to(progressBarFill, {
                    width: `${progress}%`, 
                    duration: 0.5, 
                    ease: "power2.out"
                });
                
                // Hide loading bar after a short delay
                setTimeout(() => {
                    gsap.to(loadingProgress, {
                        opacity: 0, 
                        duration: 0.5, 
                        onComplete: () => {
                            loadingProgress.classList.add('hidden');
                            loadingProgress.style.opacity = 1;
                        }
                    });
                }, 1000);
                
                return;
        }
        
        // Animate progress bar
        gsap.to(progressBarFill, {
            width: `${progress}%`, 
            duration: 0.5, 
            ease: "power2.out"
        });
        
        loadingStatus.textContent = statusText;
    }
    
    // Select an address to display details
    function selectAddress(address) {
        // Clear current selection
        document.querySelectorAll('.address-card').forEach(card => {
            card.classList.remove('pulse');
            card.classList.remove('bg-purple-900');
            card.classList.add('bg-gray-800');
        });
        
        // Highlight selected card
        const card = document.querySelector(`.address-card[data-address="${address}"]`);
        if (card) {
            card.classList.add('pulse');
            card.classList.remove('bg-gray-800');
            card.classList.add('bg-purple-900');
            
            // Scroll the card into view if needed
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            
            // Add a glow effect to the selected card
            gsap.fromTo(card, 
                {boxShadow: "0 0 10px rgba(153, 69, 255, 0.6)"},
                {boxShadow: "0 0 5px rgba(153, 69, 255, 0.4)", duration: 2, repeat: -1, yoyo: true}
            );
        }
        
        // Show details section and hide no-selection message
        noAddressSelected.classList.add('hidden');
        addressDetails.classList.remove('hidden');
        
        // Animate the details section entrance
        gsap.fromTo(addressDetails, 
            {opacity: 0, x: 20}, 
            {opacity: 1, x: 0, duration: 0.5, ease: "power2.out"}
        );
        
        // Reset charts
        if (portfolioChartInstance) {
            portfolioChartInstance.destroy();
            portfolioChartInstance = null;
        }
        
        if (historyChartInstance) {
            historyChartInstance.destroy();
            historyChartInstance = null;
        }
        
        // Show loading state for charts
        chartLoading.classList.remove('hidden');
        portfolioChart.classList.add('hidden');
        historyLoading.classList.remove('hidden');
        historyChart.classList.add('hidden');
        
        // Find address data
        selectedAddressData = addresses.find(a => a.address === address);
        
        if (selectedAddressData) {
            if (selectedAddressData.loadingStage && selectedAddressData.loadingStage !== 'complete') {
                updateLoadingProgress(selectedAddressData.loadingStage);
            } else {
                loadingProgress.classList.add('hidden');
            }
            
            renderAddressDetails();
        } else {
            // Request data from server
            if (ws && ws.readyState === WebSocket.OPEN) {
                // Show loading progress
                loadingProgress.classList.remove('hidden');
                progressBarFill.style.width = '0%';
                loadingStatus.textContent = 'Requesting data...';
                
                // Play a scanning sound
                const scanSound = new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3');
                scanSound.volume = 0.2;
                scanSound.play().catch(e => console.log('Sound play prevented:', e));
                
                // Animate progress start
                gsap.to(progressBarFill, {
                    width: '10%',
                    duration: 0.5,
                    ease: "power1.out"
                });
                
                ws.send(JSON.stringify({
                    type: "get_account",
                    address: address
                }));
            }
        }
    }
    
    // Render address details
    function renderAddressDetails() {
        if (!selectedAddressData) return;
        
        selectedAddress.textContent = selectedAddressData.address;
        solBalance.textContent = `${selectedAddressData.balance.toFixed(2)} SOL`;
        
        // Set price for SOL from the data if available
        if (selectedAddressData.portfolio) {
            const solToken = selectedAddressData.portfolio.find(t => t.symbol === "SOL");
            if (solToken && solToken.balance > 0) {
                SOL_USD_PRICE = solToken.usd_value / solToken.balance;
            }
        }
        
        usdBalance.textContent = `≈ ${(selectedAddressData.balance * SOL_USD_PRICE).toFixed(2)} USD`;
        
        // Update Solscan link
        solscanLink.href = `https://solscan.io/account/${selectedAddressData.address}`;
        
        // Update last updated time
        lastUpdated.textContent = `Updated: ${formatTimeAgo(new Date(selectedAddressData.lastUpdated).getTime() / 1000)}`;
        
        // Render security information if available
        if (selectedAddressData.security) {
            renderSecurityInfo(selectedAddressData.security);
        }
        
        // Render portfolio if available
        if (selectedAddressData.portfolio && selectedAddressData.portfolio.length > 0) {
            // Update total portfolio value
            const totalValue = selectedAddressData.totalValue || sum(selectedAddressData.portfolio.map(t => t.usd_value));
            totalPortfolioValue.textContent = `${totalValue.toFixed(2)}`;
            
            renderPortfolio(selectedAddressData.portfolio, totalValue);
            
            // Show NFT section if NFTs are available
            if (selectedAddressData.nfts && selectedAddressData.nfts.length > 0) {
                nftSection.classList.remove('hidden');
                renderNFTs(selectedAddressData.nfts);
            } else {
                nftSection.classList.add('hidden');
            }
            
            // Show historical data if available
            if (selectedAddressData.historicalData && selectedAddressData.historicalData.length > 1) {
                renderHistoricalChart(selectedAddressData.historicalData);
                historyLoading.classList.add('hidden');
                historyChart.classList.remove('hidden');
            }
        }
        
        // Render transactions
        renderTransactions();
    }
    
    // Render security information
    function renderSecurityInfo(security) {
        // Update security badge
        securityBadge.className = 'security-badge';
        
        if (security.status === 'secure') {
            securityBadge.classList.add('security-secure');
            securityBadge.innerHTML = '<i class="fas fa-shield-check mr-1"></i> Secure';
        } else if (security.status === 'warning') {
            securityBadge.classList.add('security-warning');
            securityBadge.innerHTML = '<i class="fas fa-exclamation-triangle mr-1"></i> Warning';
        } else if (security.status === 'critical') {
            securityBadge.classList.add('security-critical');
            securityBadge.innerHTML = '<i class="fas fa-exclamation-circle mr-1"></i> Critical';
        }
        
        // Update risk score
        riskScore.textContent = `${security.risk_score}/100`;
        
        // Update risk meter
        const riskPercentage = 1 - (security.risk_score / 100);
        riskMeterIndicator.style.transform = `scaleX(${riskPercentage})`;
        
        // Show/hide "no issues" message
        if (security.issues && security.issues.length > 0) {
            noSecurityIssues.classList.add('hidden');
            
            // Clear and rebuild issues list
            securityIssuesContainer.innerHTML = '';
            securityIssuesContainer.appendChild(noSecurityIssues);
            
            // Add each issue
            security.issues.forEach((issue, index) => {
                const template = document.getElementById('security-issue-template');
                const clone = template.content.cloneNode(true);
                
                const issueElement = clone.querySelector('.security-issue');
                
                // Set severity class
                if (issue.severity === 'critical') {
                    issueElement.classList.add('security-issue-critical');
                    clone.querySelector('.issue-icon').innerHTML = '<i class="fas fa-exclamation-circle text-red-400"></i>';
                } else if (issue.severity === 'warning') {
                    issueElement.classList.add('security-issue-warning');
                    clone.querySelector('.issue-icon').innerHTML = '<i class="fas fa-exclamation-triangle text-yellow-400"></i>';
                } else {
                    issueElement.classList.add('security-issue-info');
                    clone.querySelector('.issue-icon').innerHTML = '<i class="fas fa-info-circle text-blue-400"></i>';
                }
                
                clone.querySelector('.issue-title').textContent = getSeverityText(issue.severity) + ": " + getIssueTypeText(issue.type);
                clone.querySelector('.issue-description').textContent = issue.description;
                clone.querySelector('.issue-details').textContent = issue.details;
                
                // Add staggered animation using GSAP
                setTimeout(() => {
                    securityIssuesContainer.appendChild(clone);
                    
                    // Animate the issue entrance
                    const newIssue = securityIssuesContainer.lastElementChild;
                    gsap.fromTo(newIssue, 
                        {opacity: 0, y: 10}, 
                        {opacity: 1, y: 0, duration: 0.3, delay: index * 0.1}
                    );
                }, 10);
            });
        } else {
            noSecurityIssues.classList.remove('hidden');
            securityIssuesContainer.innerHTML = '';
            securityIssuesContainer.appendChild(noSecurityIssues);
        }
    }
    
    // Helper functions for security issues
    function getSeverityText(severity) {
        switch(severity) {
            case 'critical': return 'Critical';
            case 'warning': return 'Warning';
            case 'info': return 'Info';
            default: return 'Note';
        }
    }
    
    function getIssueTypeText(type) {
        switch(type) {
            case 'address_leak': return 'Address Leak';
            case 'suspicious_transactions': return 'Suspicious Transactions';
            case 'token_approvals': return 'Token Approvals';
            case 'inactive_wallet': return 'Inactive Wallet';
            case 'new_wallet': return 'New Wallet';
            case 'scan_error': return 'Scan Error';
            default: return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }
    }
    
    // Render portfolio
    function renderPortfolio(portfolio, totalValue) {
        if (!portfolio || portfolio.length === 0) return;
        
        // Sort portfolio based on selected option
        sortPortfolio(portfolio);
        
        // Render portfolio list
        renderPortfolioList(portfolio, totalValue);
        
        // Render portfolio chart with a slight delay to improve performance
        setTimeout(() => {
            renderPortfolioChart(portfolio, totalValue);
            
            // Animate chart appearance
            gsap.to(chartLoading, {
                opacity: 0,
                duration: 0.3,
                onComplete: () => {
                    chartLoading.classList.add('hidden');
                    portfolioChart.classList.remove('hidden');
                    gsap.fromTo(portfolioChart, 
                        {opacity: 0, scale: 0.95}, 
                        {opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.2)"}
                    );
                }
            });
        }, 50);
    }
    
    // Sort portfolio based on the selected option
    function sortPortfolio(portfolio) {
        const sortOption = sortOptions.value;
        
        switch(sortOption) {
            case 'value':
                portfolio.sort((a, b) => b.usd_value - a.usd_value);
                break;
            case 'name':
                portfolio.sort((a, b) => a.symbol.localeCompare(b.symbol));
                break;
            case 'percent':
                const totalValue = sum(portfolio.map(t => t.usd_value));
                portfolio.sort((a, b) => {
                    const percentA = totalValue > 0 ? (a.usd_value / totalValue) : 0;
                    const percentB = totalValue > 0 ? (b.usd_value / totalValue) : 0;
                    return percentB - percentA;
                });
                break;
        }
    }
    
    // Render portfolio list
    function renderPortfolioList(portfolio, totalValue) {
        portfolioList.innerHTML = '';
        
        if (portfolio.length === 0) {
            portfolioList.innerHTML = `
                <div class="text-center text-gray-500 py-8 fade-in">
                    <i class="fas fa-coins text-4xl mb-3"></i>
                    <p>No tokens found in this wallet</p>
                </div>`;
            return;
        }
        
        portfolio.forEach((token, index) => {
            const template = document.getElementById('token-item-template');
            const clone = template.content.cloneNode(true);
            
            const tokenName = clone.querySelector('.token-name');
            tokenName.textContent = token.symbol;
            
            const tokenBalance = clone.querySelector('.token-balance');
            tokenBalance.textContent = `${token.balance.toFixed(token.symbol === 'SOL' ? 4 : 2)} ${token.symbol}`;
            
            const tokenValue = clone.querySelector('.token-value');
            tokenValue.textContent = `${token.usd_value.toFixed(2)}`;
            
            const tokenPercent = clone.querySelector('.token-percent');
            const percent = totalValue > 0 ? (token.usd_value / totalValue * 100) : 0;
            tokenPercent.textContent = `${percent.toFixed(2)}%`;
            
            const tokenLogo = clone.querySelector('.token-logo');
            if (token.logo) {
                tokenLogo.src = token.logo;
            }
            
            const item = document.createElement('div');
            item.appendChild(clone);
            item.style.opacity = 0;
            
            portfolioList.appendChild(item);
            
            // Animate item entrance
            gsap.to(item, {
                opacity: 1,
                duration: 0.3,
                delay: index * 0.05,
                ease: "power1.out"
            });
        });
    }
    
    // Render portfolio chart
    function renderPortfolioChart(portfolio, totalValue) {
        // Filter out very small values for better visual
        const chartPortfolio = portfolio.filter(token => token.usd_value > totalValue * 0.01);
        
        // If we have more than 7 tokens, group the smallest ones into "Other"
        let chartData = chartPortfolio;
        if (chartPortfolio.length > 7) {
            // Sort by value
            const sortedPortfolio = [...chartPortfolio].sort((a, b) => b.usd_value - a.usd_value);
            
            // Take top 6
            const topTokens = sortedPortfolio.slice(0, 6);
            
            // Combine rest into "Other"
            const otherTokens = sortedPortfolio.slice(6);
            const otherValue = sum(otherTokens.map(t => t.usd_value));
            
            if (otherValue > 0) {
                topTokens.push({
                    symbol: 'Other',
                    usd_value: otherValue
                });
            }
            
            chartData = topTokens;
        }
        
        const ctx = document.getElementById('portfolio-chart').getContext('2d');
        
        // Prepare data for chart
        const data = {
            labels: chartData.map(t => t.symbol),
            datasets: [{
                data: chartData.map(t => t.usd_value),
                backgroundColor: generateColors(chartData.length),
                borderWidth: 0,
                hoverOffset: 4
            }]
        };
        
        // Destroy old chart if exists
        if (portfolioChartInstance) {
            portfolioChartInstance.destroy();
        }
        
        // Create new chart
        portfolioChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 800,
                    easing: 'easeOutCubic'
                },
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#E1E1E1',
                            font: {
                                family: 'Inter',
                                size: 11
                            },
                            boxWidth: 15,
                            padding: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                const percent = totalValue > 0 ? (value / totalValue * 100).toFixed(2) : 0;
                                return `${context.label}: ${value.toFixed(2)} (${percent}%)`;
                            }
                        },
                        backgroundColor: 'rgba(24, 24, 31, 0.85)',
                        padding: 10,
                        titleFont: {
                            family: 'Inter',
                            size: 14
                        },
                        bodyFont: {
                            family: 'Inter',
                            size: 13
                        },
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        displayColors: true,
                        boxWidth: 8,
                        boxHeight: 8,
                        boxPadding: 4,
                        usePointStyle: true
                    }
                }
            }
        });
    }
    
    // Render historical performance chart
    function renderHistoricalChart(historicalData) {
        if (historicalData.length < 2) return; // Need at least 2 points
        
        const ctx = document.getElementById('history-chart').getContext('2d');
        
        // Process data
        const data = historicalData.map(point => ({
            x: new Date(point.timestamp),
            y: point.value
        }));
        
        // Destroy old chart if exists
        if (historyChartInstance) {
            historyChartInstance.destroy();
        }
        
        // Create new chart
        historyChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Portfolio Value',
                    data: data,
                    borderColor: '#9945FF',
                    backgroundColor: 'rgba(153, 69, 255, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    pointBackgroundColor: '#14F195',
                    pointBorderColor: 'rgba(20, 241, 149, 0.8)',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: {
                                day: 'MMM d'
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#909090'
                        }
                    },
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#909090',
                            callback: function(value) {
                                return "$" + value.toFixed(0);
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return "$" + context.raw.y.toFixed(2);
                            }
                        },
                        backgroundColor: 'rgba(24, 24, 31, 0.85)',
                        titleFont: {
                            family: 'Inter',
                            size: 13
                        },
                        bodyFont: {
                            family: 'Inter',
                            size: 12
                        },
                        padding: 10,
                        borderColor: 'rgba(255, 255, 255, 0.05)',
                        borderWidth: 1
                    }
                }
            }
        });
        
        // Show chart with animation
        gsap.to(historyLoading, {
            opacity: 0, 
            duration: 0.3,
            onComplete: () => {
                historyLoading.classList.add('hidden');
                historyChart.classList.remove('hidden');
                gsap.fromTo(historyChart, 
                    {opacity: 0, y: 10}, 
                    {opacity: 1, y: 0, duration: 0.5}
                );
            }
        });
    }
    
    // Render NFT gallery
    function renderNFTs(nfts) {
        nftGallery.innerHTML = '';
        
        if (!nfts || nfts.length === 0) {
            nftSection.classList.add('hidden');
            return;
        }
        
        // Limit to first 12 NFTs to avoid overwhelming the UI
        const displayNfts = nfts.slice(0, 12);
        
        displayNfts.forEach((nft, index) => {
            const template = document.getElementById('nft-card-template');
            const clone = template.content.cloneNode(true);
            
            const nftName = clone.querySelector('.nft-name');
            nftName.textContent = nft.content?.metadata?.name || 'Unnamed NFT';
            
            const nftCollection = clone.querySelector('.nft-collection');
            nftCollection.textContent = nft.content?.metadata?.collection?.name || 'Unknown Collection';
            
            const nftImage = clone.querySelector('.nft-image');
            if (nft.content?.links?.image) {
                nftImage.src = nft.content.links.image;
            }
            
            const card = document.createElement('div');
            card.style.opacity = 0;
            card.appendChild(clone);
            nftGallery.appendChild(card);
            
            // Animate NFT cards
            gsap.to(card, {
                opacity: 1,
                duration: 0.3,
                delay: index * 0.05,
                ease: "power1.out"
            });
        });
        
        // Reveal NFT section with animation
        if (nftSection.classList.contains('hidden')) {
            nftSection.classList.remove('hidden');
            gsap.fromTo(nftSection, 
                {opacity: 0, y: 20}, 
                {opacity: 1, y: 0, duration: 0.5, ease: "power2.out"}
            );
        }
        
        // Show total count if there are more NFTs
        if (nfts.length > 12) {
            const countElement = document.createElement('div');
            countElement.className = 'text-right text-sm text-gray-400 mt-2';
            countElement.textContent = `Showing 12 of ${nfts.length} NFTs`;
            nftGallery.parentNode.appendChild(countElement);
        }
    }
    
    // Render transactions
    function renderTransactions() {
        if (!selectedAddressData || !selectedAddressData.recentTransactions) return;
        
        transactionsList.innerHTML = '';
        
        if (selectedAddressData.recentTransactions.length === 0) {
            transactionsList.innerHTML = `
                <div class="text-center text-gray-500 py-8 fade-in">
                    <i class="fas fa-inbox text-4xl mb-3"></i>
                    <p>No recent transactions found</p>
                </div>`;
            return;
        }
        
        selectedAddressData.recentTransactions.forEach((tx, index) => {
            const template = document.getElementById('transaction-item-template');
            const clone = template.content.cloneNode(true);
            
            const signature = clone.querySelector('.signature');
            signature.textContent = formatAddress(tx.signature);
            
            const timestamp = clone.querySelector('.timestamp');
            timestamp.textContent = formatTimeAgo(tx.blockTime);
            
            const status = clone.querySelector('.status');
            status.textContent = tx.err ? 'Failed' : 'Confirmed';
            
            const statusIndicator = clone.querySelector('.status-indicator');
            statusIndicator.classList.remove('bg-green-500');
            statusIndicator.classList.add(tx.err ? 'bg-red-500' : 'bg-green-500');
            
            const explorerLink = clone.querySelector('.explorer-link');
            explorerLink.href = `https://solscan.io/tx/${tx.signature}`;
            
            const item = document.createElement('div');
            item.style.opacity = 0;
            item.appendChild(clone);
            
            transactionsList.appendChild(item);
            
            // Animate transactions
            gsap.to(item, {
                opacity: 1,
                duration: 0.2,
                delay: index * 0.03,
                ease: "power1.out"
            });
        });
    }
    
    // Utility: Sum an array of numbers
    function sum(arr) {
        return arr.reduce((a, b) => a + b, 0);
    }
    
    // Utility: Generate colors for chart
    function generateColors(count) {
        const baseColors = [
            '#9945FF', // Solana Purple
            '#14F195', // Solana Green
            '#00C2FF', // Cyan
            '#FF8B3E', // Orange
            '#FF5E5E', // Red
            '#FFD166', // Yellow
            '#E4007A', // Pink
            '#784BA0', // Purple
            '#4BC0C0', // Teal
            '#3D5A80'  // Blue
        ];
        
        // If we have enough base colors, use them
        if (count <= baseColors.length) {
            return baseColors.slice(0, count);
        }
        
        // Otherwise, generate additional colors
        const colors = [...baseColors];
        for (let i = baseColors.length; i < count; i++) {
            const h = Math.floor(Math.random() * 360);
            const s = 70 + Math.floor(Math.random() * 30);
            const l = 40 + Math.floor(Math.random() * 20);
            colors.push(`hsl(${h}, ${s}%, ${l}%)`);
        }
        
        return colors;
    }
    
    // Utility: Format address for display (truncate middle)
    function formatAddress(address) {
        if (!address) return '';
        if (address.length <= 12) return address;
        return `${address.substring(0, 6)}...${address.substring(address.length - 6)}`;
    }
    
    // Utility: Format time ago
    function formatTimeAgo(timestamp) {
        if (!timestamp) return 'Unknown';
        
        const now = Math.floor(Date.now() / 1000);
        const secondsAgo = now - timestamp;
        
        if (secondsAgo < 60) return `${Math.floor(secondsAgo)}s ago`;
        if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
        if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
        return `${Math.floor(secondsAgo / 86400)}d ago`;
    }
    
    // Event: Sort options change
    sortOptions.addEventListener('change', () => {
        if (selectedAddressData && selectedAddressData.portfolio) {
            // Re-render portfolio with current sort option
            const totalValue = selectedAddressData.totalValue || sum(selectedAddressData.portfolio.map(t => t.usd_value));
            renderPortfolio(selectedAddressData.portfolio, totalValue);
        }
    });
    
    // Event: Scan button click
    scanBtn.addEventListener('click', () => {
        const address = addressSearch.value.trim();
        if (address) {
            if (ws && ws.readyState === WebSocket.OPEN) {
                // Show loading state with animation
                gsap.to(scanBtn, {
                    scale: 0.95,
                    duration: 0.1,
                    yoyo: true,
                    repeat: 1
                });
                
                scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Scanning...';
                
                // Update UI to show we're loading data
                noAddressSelected.classList.add('hidden');
                addressDetails.classList.remove('hidden');
                loadingProgress.classList.remove('hidden');
                
                // Animate progress bar
                progressBarFill.style.width = '0%';
                loadingStatus.textContent = 'Requesting data...';
                gsap.to(progressBarFill, {
                    width: '10%',
                    duration: 0.5, 
                    ease: "power1.out"
                });
                
                ws.send(JSON.stringify({
                    type: "get_account",
                    address: address
                }));
                
                setTimeout(() => {
                    scanBtn.innerHTML = '<i class="fas fa-shield-alt mr-2"></i> Scan Address';
                }, 3000);
            }
        } else {
            // Shake animation if no address entered
            gsap.to(addressSearch, {
                x: [-5, 5, -5, 5, 0],
                duration: 0.4,
                ease: "power1.inOut"
            });
            
            addressSearch.classList.add('ring-2', 'ring-red-500');
            setTimeout(() => {
                addressSearch.classList.remove('ring-2', 'ring-red-500');
            }, 1000);
        }
    });
    
    // Event: Refresh button click
    refreshBtn.addEventListener('click', () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: "refresh_all"
            }));
            
            // Show loading state with animation
            gsap.to(refreshBtn, {
                scale: 0.95,
                duration: 0.1,
                yoyo: true,
                repeat: 1
            });
            
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Refreshing...';
            setTimeout(() => {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i> Refresh';
            }, 2000);
        }
    });
    
    // Event: Address search enter key
    addressSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            scanBtn.click();
        }
    });
    
    // Event: Share button click
    document.getElementById('share-btn').addEventListener('click', () => {
        if (selectedAddressData) {
            const url = new URL(window.location.href);
            url.searchParams.set('address', selectedAddressData.address);
            
            navigator.clipboard.writeText(url.toString())
                .then(() => {
                    // Show success notification
                    const notification = document.createElement('div');
                    notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 fade-in';
                    notification.innerHTML = '<i class="fas fa-check-circle mr-2"></i> Link copied to clipboard';
                    document.body.appendChild(notification);
                    
                    // Animate notification
                    gsap.fromTo(notification, 
                        {y: -20, opacity: 0}, 
                        {y: 0, opacity: 1, duration: 0.3, ease: "power2.out"}
                    );
                    
                    setTimeout(() => {
                        gsap.to(notification, {
                            y: -20, 
                            opacity: 0, 
                            duration: 0.3, 
                            ease: "power2.in",
                            onComplete: () => notification.remove()
                        });
                    }, 3000);
                })
                .catch(err => {
                    console.error('Failed to copy:', err);
                });
            
            // Button press animation
            gsap.to('#share-btn', {
                scale: 0.9,
                duration: 0.1,
                yoyo: true,
                repeat: 1
            });
        }
    });
    
    // Event: Export button click
    document.getElementById('export-btn').addEventListener('click', () => {
        if (selectedAddressData) {
            const exportData = {
                address: selectedAddressData.address,
                balance: selectedAddressData.balance,
                totalValue: selectedAddressData.totalValue,
                lastUpdated: selectedAddressData.lastUpdated,
                portfolio: selectedAddressData.portfolio,
                transactions: selectedAddressData.recentTransactions,
                security: selectedAddressData.security
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `solana-address-${formatAddress(selectedAddressData.address)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Button press animation
            gsap.to('#export-btn', {
                scale: 0.9,
                duration: 0.1,
                yoyo: true,
                repeat: 1
            });
        }
    });
    
    // Initial page animations
    gsap.timeline()
        .from('.circle-1', {opacity: 0, scale: 0.2, duration: 1.5, ease: "power2.out"}, 0)
        .from('.circle-2', {opacity: 0, scale: 0.2, duration: 1.5, ease: "power2.out"}, 0.2)
        .from('.circle-3', {opacity: 0, scale: 0.2, duration: 1.5, ease: "power2.out"}, 0.4);
    
    // Check URL for address parameter
    const urlParams = new URLSearchParams(window.location.search);
    const addressParam = urlParams.get('address');
    if (addressParam) {
        // Wait a moment for websocket connection and initial data load
        setTimeout(() => {
            addressSearch.value = addressParam;
            scanBtn.click();
        }, 1000);
    }
});