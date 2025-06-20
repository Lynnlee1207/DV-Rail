// Data loading and processing
async function loadData() {
    try {
        console.log('Starting data loading...');
        
        // Load CSV data
        const csvData = await d3.csv('data/european_train_punctuality.csv')
            .catch(error => {
                console.error('Error loading CSV:', error);
                throw new Error('Failed to load train punctuality data');
            });
        console.log('CSV data loaded:', csvData);

        // Load GeoJSON data
        const geoData = await d3.json('https://raw.githubusercontent.com/leakyMirror/map-of-europe/master/GeoJSON/europe.geojson')
            .catch(error => {
                console.error('Error loading GeoJSON:', error);
                throw new Error('Failed to load map data');
            });
        console.log('GeoJSON data loaded:', geoData);

        // Process data into country-based structure
        const countryData = new Map();
        csvData.forEach(operator => {
            let country = operator.Country;
            // Special handling for UK/France case
            if (country === 'UK/France') {
                ['UK', 'France'].forEach(c => {
                    if (!countryData.has(c)) {
                        countryData.set(c, []);
                    }
                    countryData.get(c).push({
                        operator: operator.Operator,
                        punctuality: +operator['Punctuality (%)'],
                        cancellation: +operator['Cancellation Rate (%)'],
                        ticketPrice: +operator['Ticket Price (€/km)'],
                        compensation: +operator['Compensation Policy Score (/10)'],
                        booking: +operator['Booking Experience Score (/10)'],
                        night: +operator['Night Train Offer Score (/10)'],
                        cycling: +operator['Cycling Policy Score (/10)']
                    });
                });
            } else {
                if (!countryData.has(country)) {
                    countryData.set(country, []);
                }
                countryData.get(country).push({
                    operator: operator.Operator,
                    punctuality: +operator['Punctuality (%)'],
                    cancellation: +operator['Cancellation Rate (%)'],
                    ticketPrice: +operator['Ticket Price (€/km)'],
                    compensation: +operator['Compensation Policy Score (/10)'],
                    booking: +operator['Booking Experience Score (/10)'],
                    night: +operator['Night Train Offer Score (/10)'],
                    cycling: +operator['Cycling Policy Score (/10)']
                });
            }
        });

        return {
            countryData,
            geoData: geoData
        };
    } catch (error) {
        console.error('Error in loadData:', error);
        throw error;
    }
}

// Calculate statistics
function calculateStatistics(countryData) {
    try {
        let ukOperators = [];
        let euOperators = [];
        
        // Separate UK and EU operators
        countryData.forEach((operators, country) => {
            if (country === 'UK') {
                ukOperators = ukOperators.concat(operators);
            } else if (country !== 'UK/France') { // Exclude UK/France joint operators from EU average
                euOperators = euOperators.concat(operators);
            }
        });
        
        // Calculate averages
        const ukAvgPunctuality = d3.mean(ukOperators, d => d.punctuality);
        const euAvgPunctuality = d3.mean(euOperators, d => d.punctuality);
        const performanceGap = ukAvgPunctuality - euAvgPunctuality;

        // Update the statistics display
        const euCard = document.querySelector('.stat-item:nth-child(1) .stat-value');
        const ukCard = document.querySelector('.stat-item:nth-child(2) .stat-value');
        const gapCard = document.querySelector('.stat-item:nth-child(3) .stat-value');

        if (euCard && ukCard && gapCard) {
            // Format numbers to one decimal place
            euCard.textContent = euAvgPunctuality.toFixed(1) + '%';
            ukCard.textContent = ukAvgPunctuality.toFixed(1) + '%';
            gapCard.textContent = performanceGap.toFixed(1) + '%';
        }

        return {
            ukAvgPunctuality,
            euAvgPunctuality,
            performanceGap
        };
    } catch (error) {
        console.error('Error calculating statistics:', error);
        throw error;
    }
}

// Create color scale for the map
function createColorScale() {
    return d3.scaleThreshold()
        .domain([75, 80, 85, 90])
        .range(['#b6b7d8', '#8e8fc7', '#6668b5', '#1e3a8a']);
}

// Create and update the map
function createMap(container, geoData, countryData, colorScale) {
    try {
        console.log('Creating map...');
        // Set fixed width and height for the map as in reference code
        const width = 500;
        const height = 500;

        // Clear any existing SVG
        d3.select(container).selectAll('svg').remove();

        // Create SVG exactly as in reference code
        const svg = d3.select("#mapChart")
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${width + 120} ${height}`);

        // Create map group
        const mapGroup = svg.append("g");

        // Create projection using reference code settings
        const projection = d3.geoMercator()
            .center([5, 52])
            .scale(600)
            .translate([width / 2, height / 2 - 30]);

        const path = d3.geoPath().projection(projection);

        // Add zoom behavior exactly as in reference code
        const zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on("zoom", (event) => {
                mapGroup.attr("transform", event.transform);
            });

        svg.call(zoom);

        // Calculate country averages
        const countryAverages = new Map();
        const countryDetails = new Map();

        for (const [country, operators] of countryData) {
            const avgPunctuality = d3.mean(operators, d => d.punctuality);
            const avgCancellation = d3.mean(operators, d => d.cancellation);
            const avgPrice = d3.mean(operators, d => d.ticketPrice);
            
            countryAverages.set(country, avgPunctuality);
            countryDetails.set(country, {
                punctuality: avgPunctuality,
                cancellation: avgCancellation,
                price: avgPrice,
                operators: operators.length,
                bestOperator: operators.reduce((a, b) => a.punctuality > b.punctuality ? a : b)
            });
        }

        // Function to get country name mapping
        function getCountryName(feature) {
            const name = feature.properties.NAME;
            const nameMapping = {
                "United Kingdom": "UK",
                "Great Britain": "UK",
                "England": "UK",
                "Britain": "UK",
                "UK": "UK",
                "Czech Republic": "Czechia",
                "United Kingdom of Great Britain and Northern Ireland": "UK"
            };
            return nameMapping[name] || name;
        }

        // Draw countries
        const countries = mapGroup.selectAll("path")
            .data(geoData.features)
            .enter()
            .append("path")
            .attr("d", path)
            .attr("class", "country-path")
            .attr("fill", d => {
                const countryName = getCountryName(d);
                return countryAverages.has(countryName) ? colorScale(countryAverages.get(countryName)) : "#e5e7eb";
            })
            .attr("stroke", "#fff")
            .attr("stroke-width", 0.5)
            .attr("cursor", "pointer");

        // Add interactions
        countries
            .on("mouseover", function(event, d) {
                const countryName = getCountryName(d);
                if (countryAverages.has(countryName)) {
                    const details = countryDetails.get(countryName);
                    d3.select(this)
                        .attr("stroke-width", 2)
                        .attr("stroke", "#000");
                    
                    const tooltip = d3.select('#map-tooltip');
                    tooltip
                        .style("opacity", 1)
                        .html(`
                            <div class="tooltip-content">
                                <div class="country-name">${countryName}</div>
                                <div class="details">
                                    <div>Punctuality: ${details.punctuality.toFixed(1)}%</div>
                                    <div>Cancellation: ${details.cancellation.toFixed(1)}%</div>
                                    <div>Avg. Price: €${details.price.toFixed(2)}/km</div>
                                    <div>Operators: ${details.operators}</div>
                                </div>
                            </div>
                        `)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 10) + "px");
                }
            })
            .on("mouseout", function() {
                d3.select(this)
                    .attr("stroke-width", 0.5)
                    .attr("stroke", "#fff");
                d3.select('#map-tooltip').style("opacity", 0);
            })
            .on("click", function(event, d) {
                const countryName = getCountryName(d);
                if (countryAverages.has(countryName)) {
                    // Reset all countries
                    countries.attr("stroke-width", 0.5).attr("stroke", "#fff");
                    
                    // Highlight selected country
                    d3.select(this)
                        .attr("stroke-width", 2)
                        .attr("stroke", "#000");
                    
                    // Update details panel with operators data
                    const details = countryDetails.get(countryName);
                    const operators = countryData.get(countryName);
                    updateCountryDetails(countryName, details, operators);
                }
            });

        // Create legend
        const legendWidth = 200;
        const legendHeight = 10;
        const legendX = width - 100;
        const legendY = height - 30;

        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${legendX}, ${legendY})`);

        const legendScale = d3.scaleLinear()
            .domain([70, 95])
            .range([0, legendWidth]);

        const legendAxis = d3.axisBottom(legendScale)
            .ticks(5)
            .tickFormat(d => d + "%");

        // Create gradient
        const defs = svg.append("defs");
        const gradient = defs.append("linearGradient")
            .attr("id", "legend-gradient")
            .attr("x1", "0%")
            .attr("x2", "100%");

        const colors = ['#b6b7d8', '#8e8fc7', '#6668b5', '#1e3a8a'];
        colors.forEach((color, i) => {
            gradient.append("stop")
                .attr("offset", `${i * 33.33}%`)
                .attr("stop-color", color);
        });

        legend.append("rect")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .style("fill", "url(#legend-gradient)");

        legend.append("g")
            .attr("transform", `translate(0, ${legendHeight})`)
            .call(legendAxis);

        legend.append("text")
            .attr("x", legendWidth / 2)
            .attr("y", -5)
            .attr("text-anchor", "middle")
            .style("font-size", "12px")
            .text("Punctuality Rate");

        // Function to highlight top 5 countries
        function highlightTop5() {
            // Get top 5 countries by punctuality
            const top5 = Array.from(countryAverages.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(entry => entry[0]);

            // Fade out all countries first
            countries
                .transition()
                .duration(800)
                .attr("fill", d => {
                    const countryName = getCountryName(d);
                    return top5.includes(countryName) ? colorScale(countryAverages.get(countryName)) : "#e5e7eb";
                })
                .attr("opacity", d => top5.includes(getCountryName(d)) ? 1 : 0.2)
                .attr("stroke-width", d => top5.includes(getCountryName(d)) ? 2 : 0.5)
                .attr("stroke", d => top5.includes(getCountryName(d)) ? "#000" : "#fff");

            // Remove previous annotation cards
            d3.selectAll(".annotation-card").remove();
            
            // Add annotation cards for top 5
            top5.forEach((country, index) => {
                const details = countryDetails.get(country);
                const card = d3.select("#mapChart")
                    .append("div")
                    .attr("class", "annotation-card")
                    .style("left", `${index < 3 ? 50 + index * 220 : 160 + (index - 3) * 220}px`) // Adjust horizontal position based on row
                    .style("top", `${index < 3 ? 20 : 100}px`) // Second row starts at 100px from top
                    .html(`
                        <div class="font-semibold">${country}</div>
                        <div class="text-sm">${details.punctuality.toFixed(1)}% punctual</div>
                    `);
                setTimeout(() => card.classed("visible", true), 100 * index);
            });
        }

        // Function to focus on UK
        function focusOnUK() {
            // Fade out all countries first
            countries
                .transition()
                .duration(800)
                .attr("fill", d => getCountryName(d) === "UK" ? colorScale(countryAverages.get("UK")) : "#e5e7eb")
                .attr("opacity", d => getCountryName(d) === "UK" ? 1 : 0.2)
                .attr("stroke-width", d => getCountryName(d) === "UK" ? 2 : 0.5)
                .attr("stroke", d => getCountryName(d) === "UK" ? "#ef4444" : "#fff");

            // Remove previous annotation cards
            d3.selectAll(".annotation-card").remove();
            
            // Add UK annotation
            const ukDetails = countryDetails.get("UK");
            const card = d3.select("#mapChart")
                .append("div")
                .attr("class", "annotation-card")
                .style("left", "50px")
                .style("top", "20px")
                .html(`
                    <div class="font-semibold text-red-600">United Kingdom</div>
                    <div class="text-sm">Punctuality: ${ukDetails.punctuality.toFixed(1)}%</div>
                    <div class="text-sm">Below EU Average</div>
                `);
            setTimeout(() => card.classed("visible", true), 100);

            // Update details panel
            updateCountryDetails("UK", ukDetails, countryData.get("UK"));
        }

        // Function to reset map
        function resetMap() {
            // Remove all annotations
            d3.selectAll(".annotation-card").remove();
            
            // Reset all countries
            countries
                .transition()
                .duration(800)
                .attr("fill", d => {
                    const countryName = getCountryName(d);
                    return countryAverages.has(countryName) ? colorScale(countryAverages.get(countryName)) : "#e5e7eb";
                })
                .attr("opacity", 1)
                .attr("stroke-width", 0.5)
                .attr("stroke", "#fff");
                
            // Reset zoom
            mapGroup.transition()
                .duration(800)
                .attr("transform", "translate(0,0)scale(1)");
        }

        // Add button event listeners
        document.getElementById("showTop5")?.addEventListener("click", () => {
            resetMap();
            setTimeout(highlightTop5, 100);
        });

        document.getElementById("showUK")?.addEventListener("click", () => {
            resetMap();
            setTimeout(focusOnUK, 100);
        });

        document.getElementById("resetMap")?.addEventListener("click", resetMap);

        // Return the functions
        return {
            highlightTop5: () => highlightTop5(),
            focusOnUK: () => focusOnUK(),
            resetMap: () => resetMap()
        };
    } catch (error) {
        console.error('Error in createMap:', error);
        throw error;
    }
}

// Function to update country details panel
function updateCountryDetails(countryName, details, operators) {
    const detailsPanel = document.querySelector('.country-details');
    if (!detailsPanel) return;

    // Determine performance status
    const status = details.punctuality >= 90 ? 'Excellent' : 
                  details.punctuality >= 85 ? 'Good' :
                  details.punctuality >= 80 ? 'Average' : 'Needs Improvement';
    
    const statusColor = status === 'Excellent' ? '#22c55e' : 
                       status === 'Good' ? '#3b82f6' :
                       status === 'Average' ? '#f59e0b' : '#ef4444';

    // Update header with country name and status
    detailsPanel.innerHTML = `
        <div class="country-header">
            <h2 class="country-name">${countryName}</h2>
            <span class="status-badge" style="color: ${statusColor}">${status}</span>
        </div>
        <div class="operator-count">
            ${details.operators} operator${details.operators > 1 ? 's' : ''} serving the network
        </div>

        <div class="performance-grid">
            <div class="metric-box">
                <div class="metric-label">Punctuality</div>
                <div class="metric-value" style="color: ${details.punctuality >= 85 ? '#22c55e' : '#f59e0b'}">${details.punctuality.toFixed(1)}%</div>
            </div>
            <div class="metric-box">
                <div class="metric-label">Cancellation Rate</div>
                <div class="metric-value" style="color: ${details.cancellation <= 2 ? '#22c55e' : '#ef4444'}">${details.cancellation.toFixed(1)}%</div>
            </div>
            <div class="metric-box">
                <div class="metric-label">Average Fare</div>
                <div class="metric-value" style="color: #059669">€${details.price.toFixed(2)}/km</div>
            </div>
            <div class="metric-box">
                <div class="metric-label">Service Score</div>
                <div class="metric-value" style="color: #7c3aed">${getServiceScore(operators)}</div>
            </div>
        </div>

        <div class="key-insights">
            <h3>Key Insights</h3>
            <ul>
                ${getKeyInsights(countryName, details)}
            </ul>
        </div>

        <div class="operators-section">
            <div class="operators-header">
                <h5>Operators</h5>
                <h5>Punctuality</h5>
            </div>
            <div class="operators-container">
                ${operators.length > 0 ? 
                    operators.map(operator => `
                        <div class="operator-item">
                            <span class="operator-name">${operator.operator}</span>
                            <span class="operator-score" style="color: ${operator.punctuality >= 85 ? '#22c55e' : '#ef4444'}">
                                ${operator.punctuality ? operator.punctuality.toFixed(1) + '%' : 'N/A'}
                            </span>
                        </div>
                    `).join('')
                    : 'No operator data available'
                }
            </div>
        </div>
    `;
}

function getKeyInsights(countryName, details) {
    const insights = [];
    const euAvgPunctuality = 82.8; // EU average punctuality
    const avgPrice = 0.22; // Average ticket price per km

    // Punctuality insights
    if (details.punctuality >= 90) {
        insights.push('Demonstrates exceptional punctuality performance');
        if (details.cancellation < 1.5) {
            insights.push('Maintains high reliability with low cancellation rates');
        }
    } else if (details.punctuality < euAvgPunctuality) {
        insights.push('Shows potential for punctuality improvement');
        const gap = (euAvgPunctuality - details.punctuality).toFixed(1);
        insights.push(`${gap}% below EU punctuality benchmark`);
    }

    // Price insights
    if (details.price > avgPrice) {
        const priceDiff = ((details.price - avgPrice) / avgPrice * 100).toFixed(0);
        insights.push(`${priceDiff}% higher than average ticket prices`);
    } else {
        insights.push('Competitive pricing structure');
    }

    // Service quality insights
    const serviceScore = (details.punctuality / 10 + 1).toFixed(1);
    if (serviceScore >= 9) {
        insights.push('Excellent digital booking experience');
        insights.push('Top-tier customer service standards');
    } else if (serviceScore <= 8) {
        insights.push('Room for service quality enhancement');
    }

    // Special insights for specific countries
    if (countryName === 'Switzerland') {
        insights.push('Leading European rail service provider');
    } else if (countryName === 'UK') {
        insights.push('Ongoing modernization of rail infrastructure');
    }

    // Return only the first 3 most relevant insights
    return insights.slice(0, 3).map(insight => `
        <li>
            <span class="insight-icon">4</span>
            ${insight}
        </li>
    `).join('');
}

// Create image-based bar chart for cancellations
function createCancellationChart(data) {
    // Process data to get average cancellation rate by country
    const countryData = {};
    data.forEach(entry => {
        const country = entry.Country;
        if (country === 'UK/France') return; // Skip combined entries
        
        if (!countryData[country]) {
            countryData[country] = {
                total: 0,
                count: 0
            };
        }
        countryData[country].total += parseFloat(entry['Cancellation Rate (%)']);
        countryData[country].count += 1;
    });

    // Calculate averages and convert to array
    const averagedData = Object.entries(countryData).map(([country, data]) => ({
        Country: country,
        'Cancellation Rate (%)': data.total / data.count
    }));

    // Sort by cancellation rate and take top 8
    const sortedData = averagedData
        .sort((a, b) => b['Cancellation Rate (%)'] - a['Cancellation Rate (%)'])
        .slice(0, 8);
    
    // Define image mappings
    const imageMapping = {
        'Germany': 'germany-db.jpg',
        'UK': 'uk-euston.jpg',
        'Sweden': 'sweden-snow.jpg',
        'Portugal': 'portugal-station.jpg',
        'Poland': 'poland-platform.jpg',
        'Italy': 'italy-milan.jpg',
        'France': 'france-tgv.jpg',
        'Slovakia': 'slovakia-station.jpg',
        'Netherlands': 'netherlands-station.jpg'
    };

    // Define color scale based on cancellation rate
    const colorScale = d3.scaleThreshold()
        .domain([2, 3, 4, 5])
        .range(['#b6b7d8', '#8e8fc7', '#6668b5', '#1e3a8a']);

    const chart = d3.select('#cancellationChart');
    const chartWidth = chart.node().getBoundingClientRect().width;
    const barWidth = 75;
    const barGap = (chartWidth - (barWidth * sortedData.length)) / (sortedData.length + 1);

    // Create bars
    const bars = chart.selectAll('.bar-container')
        .data(sortedData)
        .enter()
        .append('div')
        .attr('class', 'bar-container')
        .style('position', 'absolute')
        .style('bottom', '0')
        .style('left', (d, i) => `${barGap + i * (barWidth + barGap)}px`)
        .style('width', `${barWidth}px`);

    // Add image bars
    bars.append('div')
        .attr('class', 'bar-image')
        .style('height', d => `${d['Cancellation Rate (%)'] * 80}px`)
        .style('background-image', d => `url(assets/images/${imageMapping[d.Country]})`)
        .style('opacity', 0)
        .transition()
        .duration(800)
        .style('opacity', 1);

    // Add color overlay
    bars.append('div')
        .attr('class', 'bar-overlay')
        .style('height', d => `${d['Cancellation Rate (%)'] * 80}px`)
        .style('background-color', d => colorScale(d['Cancellation Rate (%)']));

    // Add annotations
    const annotations = bars.append('div')
        .attr('class', 'bar-annotation')
        .style('bottom', d => `${d['Cancellation Rate (%)'] * 80}px`);

    // Add vertical lines
    annotations.append('div')
        .attr('class', 'annotation-line')
        .style('height', '40px');  // Fixed height for the line

    // Add annotation text
    const annotationText = annotations.append('div')
        .attr('class', 'annotation-text');

    annotationText.append('div')
        .attr('class', 'annotation-label')
        .text('Cancellation Rate');

    annotationText.append('div')
        .attr('class', 'annotation-value')
        .text(d => `${d['Cancellation Rate (%)'].toFixed(1)}%`);

    // Add country labels
    bars.append('div')
        .attr('class', 'bar-label')
        .text(d => d.Country)
        .style('opacity', 0)
        .transition()
        .duration(800)
        .delay((d, i) => i * 100)
        .style('opacity', 1);

    // Add tooltips
    bars.on('mouseover', function(event, d) {
        const tooltip = d3.select('#chartTooltip');
        tooltip.style('display', 'block')
            .html(`
                <strong>${d.Country}</strong><br>
                Cancellation Rate: ${d['Cancellation Rate (%)'].toFixed(1)}%<br>
                Network Scale: ${d['Cancellation Rate (%)'] > 3 ? 'Large national operator' : 'Regional/Medium operator'}<br>
                ${getTooltipComment(d.Country)}
            `)
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`);

        d3.select(this).select('.bar-image')
            .style('transform', 'scale(1.05)')
            .style('box-shadow', '0 4px 12px rgba(0,0,0,0.2)');
    })
    .on('mouseout', function() {
        d3.select('#chartTooltip').style('display', 'none');
        d3.select(this).select('.bar-image')
            .style('transform', 'scale(1)')
            .style('box-shadow', 'none');
    });
}

// Helper function for tooltip comments
function getTooltipComment(country) {
    const comments = {
        'Germany': 'Infrastructure upgrades + staff shortages',
        'UK': 'Weather + operational bottlenecks',
        'Sweden': 'Severe weather conditions',
        'Portugal': 'Infrastructure modernization',
        'UK/France': 'Channel tunnel constraints',
        'Poland': 'Network modernization',
        'Italy': 'Regional variations',
        'France': 'Industrial action impact'
    };
    return `Comment: ${comments[country] || 'Multiple factors'}`;
}

// Create radial chart for service metrics
function createRadialChart(data) {
    // Process data to get UK and EU averages
    const ukData = data.filter(d => d.Country === 'UK')[0];
    const euData = data.filter(d => d.Country !== 'UK' && d.Country !== 'UK/France');
    
    const metrics = [
        { name: 'Booking', key: 'Booking Experience Score (/10)', icon: '📱' },
        { name: 'Compensation', key: 'Compensation Policy Score (/10)', icon: '💶' },
        { name: 'Night Train', key: 'Night Train Offer Score (/10)', icon: '🚆' },
        { name: 'Cycling', key: 'Cycling Policy Score (/10)', icon: '🚲' }
    ];

    // Calculate EU averages
    const euAverages = {};
    metrics.forEach(metric => {
        euAverages[metric.key] = d3.mean(euData, d => +d[metric.key]);
    });

    // Set up dimensions
    const svgSize = 850;
    const width = 400;
    const height = 400;
    const radius = Math.min(width, height) / 2 * 0.8;

    // Clear existing content
    d3.select('#radialChart').selectAll('*').remove();

    // Create SVG with larger canvas, but chart stays the same size and centered
    const svg = d3.select('#radialChart')
        .append('svg')
        .attr('width', svgSize)
        .attr('height', svgSize)
        .attr('viewBox', `0 0 ${svgSize} ${svgSize}`)
        .append('g')
        .attr('transform', `translate(${svgSize/2},${svgSize/2})`);

    // Add clock-like tick marks
    const ticksGroup = svg.append('g').attr('class', 'ticks');
    const numTicks = 60;
    for (let i = 0; i < numTicks; i++) {
        const angle = (i * 360 / numTicks) * (Math.PI / 180);
        const isMainTick = i % 5 === 0;
        const tickLength = isMainTick ? 10 : 5;
        const tickWidth = isMainTick ? 2 : 1;
        const outerRadius = radius + 5;
        const innerRadius = outerRadius - tickLength;

        ticksGroup.append('line')
            .attr('x1', innerRadius * Math.cos(angle - Math.PI/2))
            .attr('y1', innerRadius * Math.sin(angle - Math.PI/2))
            .attr('x2', outerRadius * Math.cos(angle - Math.PI/2))
            .attr('y2', outerRadius * Math.sin(angle - Math.PI/2))
            .attr('stroke', '#8e8fc7')
            .attr('stroke-width', tickWidth)
            .attr('opacity', 0.5);
    }

    // Create scales
    const angleScale = d3.scaleLinear()
        .domain([0, metrics.length])
        .range([0, 2 * Math.PI]);

    const radiusScale = d3.scaleLinear()
        .domain([0, 10])
        .range([radius * 0.4, radius]);

    // Create arc generator
    const arc = d3.arc()
        .innerRadius(radius * 0.4)
        .outerRadius(d => radiusScale(d.value))
        .startAngle((d, i) => angleScale(i))
        .endAngle((d, i) => angleScale(i + 1))
        .padAngle(0.02)
        .cornerRadius(4);

    // Create background arcs
    const backgroundArc = d3.arc()
        .innerRadius(radius * 0.4)
        .outerRadius(radius)
        .startAngle((d, i) => angleScale(i))
        .endAngle((d, i) => angleScale(i + 1))
        .padAngle(0.02)
        .cornerRadius(4);

    // Add background arcs with gradient
    const gradientIds = ['gradient1', 'gradient2', 'gradient3', 'gradient4'];
    const colors = ['#b6b7d8', '#8e8fc7', '#6668b5', '#1e3a8a'];

    // Create gradients
    const defs = svg.append('defs');
    gradientIds.forEach((id, i) => {
        const gradient = defs.append('radialGradient')
            .attr('id', id)
            .attr('gradientUnits', 'userSpaceOnUse')
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('r', radius);

        gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', colors[i])
            .attr('stop-opacity', 0.2);

        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', colors[i])
            .attr('stop-opacity', 0.8);
    });

    // Add background arcs
    svg.selectAll('.background-arc')
        .data(metrics)
        .enter()
        .append('path')
        .attr('class', 'background-arc')
        .attr('d', backgroundArc)
        .attr('fill', (d, i) => `url(#${gradientIds[i]})`)
        .attr('stroke', '#e2e8f0')
        .attr('stroke-width', 1);

    // Create data for arcs
    const ukArcs = metrics.map(metric => ({
        name: metric.name,
        value: +ukData[metric.key],
        euAvg: euAverages[metric.key],
        icon: metric.icon
    }));

    // Add UK arcs with glowing effect
    const arcs = svg.selectAll('.metric-arc')
        .data(ukArcs)
        .enter()
        .append('path')
        .attr('class', 'metric-arc')
        .attr('d', arc)
        .attr('fill', (d, i) => colors[i])
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .style('filter', 'url(#glow)')
        .style('cursor', 'pointer');

    // Add glow filter
    const filter = defs.append('filter')
        .attr('id', 'glow');

    filter.append('feGaussianBlur')
        .attr('stdDeviation', '3')
        .attr('result', 'coloredBlur');

    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode')
        .attr('in', 'coloredBlur');
    feMerge.append('feMergeNode')
        .attr('in', 'SourceGraphic');

    // Add icons and labels with improved positioning
    metrics.forEach((metric, i) => {
        const angle = angleScale(i + 0.5);
        const radius = radiusScale(ukArcs[i].value);
        const x = Math.cos(angle - Math.PI / 2) * (radius * 0.8);
        const y = Math.sin(angle - Math.PI / 2) * (radius * 0.8);

        const iconGroup = svg.append('g')
            .attr('class', 'metric-icon')
            .attr('transform', `translate(${x},${y})`);

        // Add circular background for icon
        iconGroup.append('circle')
            .attr('r', 16)
            .attr('fill', '#fff')
            .attr('stroke', colors[i])
            .attr('stroke-width', 2)
            .attr('opacity', 0.9);

        // Add icon
        iconGroup.append('text')
            .attr('class', 'icon')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('font-size', '1em')
            .text(metric.icon);

        // Add label text with adjusted position
        iconGroup.append('text')
            .attr('class', 'metric-label')
            .attr('text-anchor', 'middle')
            .attr('dy', '2em')
            .attr('dx', '-1.5em')  // 向左偏移
            .attr('font-family', 'PT Serif')
            .attr('font-size', '0.8rem')
            .attr('fill', '#f5f5f0')
            .text(metric.name);

    });

    // Add center decoration
    const centerGroup = svg.append('g')
        .attr('class', 'center-decoration');

    centerGroup.append('circle')
        .attr('r', radius * 0.35)
        .attr('fill', '#fff')
        .attr('stroke', '#8e8fc7')
        .attr('stroke-width', 2);

    centerGroup.append('text')
        .attr('class', 'center-text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0em')
        .attr('font-family', 'Playfair Display')
        .attr('font-size', '1.2rem')
        .attr('font-weight', '700')
        .text('UK');

    centerGroup.append('text')
        .attr('class', 'center-subtext')
        .attr('text-anchor', 'middle')
        .attr('dy', '1.5em')
        .attr('font-size', '0.8rem')
        .attr('fill', '#666')
        .text('Rail Services');

    // Enhanced tooltip functionality
    const tooltip = d3.select('#radialTooltip')
        .attr('class', 'radial-tooltip');

    // Add hover interactions (show tooltip on hover, hide on mouseout)
    arcs.on('mousemove', function(event, d) {
        // Tooltip position: higher and more to the left
        const tooltipWidth = 280;
        const tooltipHeight = 150;
        let left = event.clientX - 320;
        let top = event.clientY - tooltipHeight * 1.1; // 更高
        if (left + tooltipWidth > window.innerWidth) {
            left = event.clientX - tooltipWidth + 20;
        }
        if (top + tooltipHeight > window.innerHeight) {
            top = window.innerHeight - tooltipHeight - 10;
        }
        if (top < 10) {
            top = 10;
        }
        tooltip
            .style('left', `${left}px`)
            .style('top', `${top}px`)
            .html(`
                <div class="tooltip-header">${d.name}</div>
                <div class="tooltip-content">
                    <div class="tooltip-row">
                        <span class="tooltip-label">UK Score:</span>
                        <span class="tooltip-value" style="color: #6668b5">${d.value.toFixed(1)}/10</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="tooltip-label">EU Average:</span>
                        <span class="tooltip-value" style="color: #8e8fc7">${d.euAvg.toFixed(1)}/10</span>
                    </div>
                    <div class="tooltip-row" style="margin-top: 8px;">
                        <span class="tooltip-label">Performance:</span>
                        <span class="tooltip-value" style="color: ${d.value >= d.euAvg ? '#22c55e' : '#ef4444'}">
                            ${d.value >= d.euAvg ? 'Above Average' : 'Below Average'}
                        </span>
                    </div>
                </div>
            `)
            .classed('visible', true);
        d3.select(this)
            .transition()
            .duration(200)
            .attr('opacity', 0.8)
            .attr('transform', 'scale(1.05)');
    })
    .on('mouseout', function() {
        tooltip.classed('visible', false);
        d3.select(this)
            .transition()
            .duration(200)
            .attr('opacity', 1)
            .attr('transform', 'scale(1)');
    });

    // Draw annotation lines from each arc outward (with custom lengths)
    metrics.forEach((metric, i) => {
        const angle = angleScale(i + 0.5) - Math.PI / 2;
        const startRadius = radius * 1.05;
        // Custom endRadius for each quadrant
        let endRadius;
        if (i === 0) endRadius = radius * 1.55; // top-left (Cycling) - long
        else if (i === 1) endRadius = radius * 1.18; // top-right (Booking) - short
        else if (i === 2) endRadius = radius * 1.55; // bottom-right (Compensation) - long
        else endRadius = radius * 1.18; // bottom-left (Night Train) - short
        const x1 = Math.cos(angle) * startRadius;
        const y1 = Math.sin(angle) * startRadius;
        const x2 = Math.cos(angle) * endRadius;
        const y2 = Math.sin(angle) * endRadius;
        svg.append('line')
            .attr('x1', x1)
            .attr('y1', y1)
            .attr('x2', x2)
            .attr('y2', y2)
            .attr('stroke', '#222')
            .attr('stroke-width', 2)
            .attr('opacity', 0.7)
            .attr('class', 'annotation-line');

        // Add big title at the end of each annotation line
        let titleYOffset = 28; // default: down
        if (i === 0 || i === 3) titleYOffset = -28; // Cycling, Booking (top) move up
        svg.append('text')
            .attr('x', x2)
            .attr('y', y2 + titleYOffset)
            .attr('text-anchor', 'middle')
            .attr('font-family', 'Playfair Display, serif')
            .attr('font-size', '1.25rem')
            .attr('font-weight', 700)
            .attr('fill', '#222')
            .attr('class', 'annotation-title')
            .text(metric.name);

        // Add subtitle (italic explanation) above or below the big title
        const subtitles = [
            'Ease of digital ticketing and journey planning',
            'Refunds, delay repay, and passenger rights',
            'Overnight connections and sleeper options',
            'Bike-friendly policies and train access'
        ];
        let subtitleYOffset;
        if (i === 0 || i === 3) subtitleYOffset = -32; // Cycling, Booking: higher above
        else subtitleYOffset = 26; // Night Train, Compensation: further below
        svg.append('text')
            .attr('x', x2)
            .attr('y', y2 + titleYOffset + subtitleYOffset)
            .attr('text-anchor', 'middle')
            .attr('font-family', 'PT Serif, serif')
            .attr('font-size', '1rem')
            .attr('font-style', 'italic')
            .attr('fill', '#444')
            .attr('class', 'annotation-subtitle')
            .text(subtitles[i]);

        // Add insight (short summary) above or below the subtitle
        const insights = [
            'UK leads in mobile ticketing',
            'UK offers faster digital refunds',
            'Limited overnight routes in UK',
            'UK lags EU in bike carriage options'
        ];
        let insightYOffset;
        if (i === 0 || i === 3) insightYOffset = -52; // above subtitle for top
        else insightYOffset = 52; // below subtitle for bottom
        svg.append('text')
            .attr('x', x2)
            .attr('y', y2 + titleYOffset + insightYOffset)
            .attr('text-anchor', 'middle')
            .attr('font-family', 'PT Serif, serif')
            .attr('font-size', '0.95rem')
            .attr('fill', '#f39652')
            .attr('class', 'annotation-insight')
            .text(insights[i]);
    });
}

// Bubble Grid Chart for country-metric comparison
function createBubbleGridChart(data) {
    // 1. Prepare country-level averages for the four metrics
    const metrics = [
        { key: 'punctuality', label: 'Punctuality', csv: 'Punctuality (%)', max: 100 },
        { key: 'compensation', label: 'Compensation', csv: 'Compensation Policy Score (/10)', max: 10 },
        { key: 'booking', label: 'Booking', csv: 'Booking Experience Score (/10)', max: 10 },
        { key: 'cycling', label: 'Cycling Policy', csv: 'Cycling Policy Score (/10)', max: 10 }
    ];
    // Aggregate by country
    const countryStats = {};
    data.forEach(d => {
        const country = d.Country === 'UK/France' ? 'UK' : d.Country;
        if (!countryStats[country]) {
            countryStats[country] = { count: 0 };
            metrics.forEach(m => countryStats[country][m.key] = 0);
        }
        countryStats[country].count++;
        metrics.forEach(m => {
            countryStats[country][m.key] += +d[m.csv] || 0;
        });
    });
    // Compute averages
    Object.keys(countryStats).forEach(country => {
        metrics.forEach(m => {
            countryStats[country][m.key] /= countryStats[country].count;
        });
    });
    // 2. Select UK + 5 lowest punctuality countries (excluding UK)
    const allCountries = Object.keys(countryStats).filter(c => c !== 'UK/France');
    const sorted = allCountries.filter(c => c !== 'UK').sort((a, b) => countryStats[a].punctuality - countryStats[b].punctuality);
    const selected = ['UK', ...sorted.slice(0, 5)];
    // 3. Prepare grid data
    const gridData = [];
    selected.forEach((country, col) => {
        metrics.forEach((m, row) => {
            gridData.push({
                country,
                metric: m.label,
                value: countryStats[country][m.key],
                max: m.max,
                row,
                col
            });
        });
    });
    // 4. Draw SVG grid
    const width = 590, height = 340, margin = { top: 90, right: 20, bottom: 20, left: 110 };
    d3.select('#bubbleGridChart').selectAll('*').remove();
    const svg = d3.select('#bubbleGridChart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    // Y axis: metrics
    const y = d3.scaleBand()
        .domain(metrics.map(m => m.label))
        .range([margin.top, height - margin.bottom])
        .padding(0.1);
    svg.selectAll('.metric-label')
        .data(metrics)
        .enter()
        .append('text')
        .attr('class', 'metric-label')
        .attr('x', margin.left - 18)
        .attr('y', d => y(d.label) + y.bandwidth() / 2 + 6)
        .attr('text-anchor', 'end')
        .attr('font-family', 'PT Serif, serif')
        .attr('font-size', '0.65rem')
        .attr('fill', '#222')
        .text(d => d.label);
    // X axis: countries
    const x = d3.scaleBand()
        .domain(selected)
        .range([margin.left, width - margin.right])
        .padding(0.25);
    svg.selectAll('.country-label')
        .data(selected)
        .enter()
        .append('text')
        .attr('class', 'country-label')
        .attr('x', d => x(d) + x.bandwidth() / 2)
        .attr('y', margin.top - 28)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Playfair Display, serif')
        .attr('font-size', d => d === 'UK' ? '1.4rem' : '0.9rem')
        .attr('font-weight', d => d === 'UK' ? 700 : 600)
        .attr('fill', '#222')
        .text(d => d);
    // Draw country images in oval frames
    const imgW = 48, imgH = 32;
    const imgY = margin.top - 83; // move up by 18px
    svg.selectAll('.country-img-group')
        .data(selected)
        .enter()
        .append('g')
        .attr('class', 'country-img-group')
        .attr('transform', d => `translate(${x(d) + x.bandwidth() / 2},${imgY + imgH / 2})`);
    svg.selectAll('.country-img-group')
        .append('ellipse')
        .attr('rx', imgW / 2)
        .attr('ry', imgH / 2)
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('fill', '#fff')
        .attr('stroke', '#b6b7d8')
        .attr('stroke-width', 2);
    svg.selectAll('.country-img-group')
        .append('clipPath')
        .attr('id', (d, i) => `clip-ellipse-${i}`)
        .append('ellipse')
        .attr('rx', imgW / 2 - 1)
        .attr('ry', imgH / 2 - 1)
        .attr('cx', 0)
        .attr('cy', 0);
    svg.selectAll('.country-img-group')
        .append('image')
        .attr('x', -imgW / 2)
        .attr('y', -imgH / 2)
        .attr('width', imgW)
        .attr('height', imgH)
        .attr('href', d => `assets/images/${d.toLowerCase()}-station.jpg`)
        .attr('preserveAspectRatio', 'xMidYMid slice')
        .attr('clip-path', (d, i) => `url(#clip-ellipse-${i})`);
    // Draw a horizontal line under country codes
    svg.append('line')
        .attr('x1', margin.left)
        .attr('x2', width - margin.right)
        .attr('y1', margin.top - 6)
        .attr('y2', margin.top - 6)
        .attr('stroke', '#39607e')
        .attr('stroke-width', 2);
    // Bubble size/scale: lower value = bigger bubble (inverse)
    const minR = 24, maxR = 54;
    function getRadius(metric, value) {
        // For each metric, invert: 最差最大
        let scale = d3.scaleLinear()
            .domain([metric.max, metric.max === 100 ? 60 : 2]) // 100→60 for punctuality, 10→2 for others
            .range([minR, maxR])
            .clamp(true);
        return scale(value);
    }
    // Color scale: 4-level blue, lower value = darker
    const colorScale = d3.scaleThreshold()
        .domain([70, 80, 90])
        .range(['#1e3a8a', '#6668b5', '#8e8fc7', '#b6b7d8']);
    // Draw bubbles
    svg.selectAll('.bubble')
        .data(gridData)
        .enter()
        .append('circle')
        .attr('class', 'bubble')
        .attr('cx', d => x(d.country) + x.bandwidth() / 2)
        .attr('cy', d => y(d.metric) + y.bandwidth() / 2)
        .attr('r', d => getRadius(metrics[d.row], d.value))
        .attr('fill', d => colorScale(d.value))
        .attr('stroke', 'none')
        .attr('opacity', 0.65)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this).attr('stroke-width', 4);
            showBubbleTooltip(event, d);
        })
        .on('mousemove', function(event, d) {
            showBubbleTooltip(event, d);
        })
        .on('mouseout', function() {
            d3.select(this).attr('stroke-width', 0);
            d3.select('#bubbleGridTooltip').style('opacity', 0);
        });
    // Tooltip div
    let tooltip = d3.select('#bubbleGridTooltip');
    if (tooltip.empty()) {
        tooltip = d3.select('body').append('div')
            .attr('id', 'bubbleGridTooltip')
            .attr('class', 'radial-tooltip')
            .style('opacity', 0);
    }
    function showBubbleTooltip(event, d) {
        tooltip.html(`
            <div class='tooltip-header'>${d.country} - ${d.metric}</div>
            <div class='tooltip-content'>
                <div class='tooltip-row'><span class='tooltip-label'>Value:</span> <span class='tooltip-value'>${d.value.toFixed(2)}</span></div>
            </div>
        `)
        .style('left', (event.pageX + 18) + 'px')
        .style('top', (event.pageY - 18) + 'px')
        .style('opacity', 1)
        .classed('visible', true);
    }
}

// Rail Network Flower (Clock-style Proximity Dial)
function createNetworkFlowerChart(data) {
    // Country code mapping for csv
    const codeMap = {
        'UK': 'United Kingdom',
        'DE': 'Germany',
        'FR': 'France',
        'SE': 'Sweden',
        'IT': 'Italy',
        'PT': 'Portugal',
        'PL': 'Poland',
        'SK': 'Slovakia',
        'NL': 'Netherlands'
    };
    const countries = Object.keys(codeMap).map(code => ({ code, name: codeMap[code] }));
    // 1. 统计每国四指标均值
    const metrics = [
        { key: 'Punctuality (%)', max: 100 },
        { key: 'Compensation Policy Score (/10)', max: 10 },
        { key: 'Booking Experience Score (/10)', max: 10 },
        { key: 'Cycling Policy Score (/10)', max: 10 }
    ];
    const countryStats = {};
    data.forEach(d => {
        // UK/France算到UK和France
        let countryList = d.Country === 'UK/France' ? ['UK', 'France'] : [d.Country];
        countryList.forEach(country => {
            if (!countryStats[country]) {
                countryStats[country] = { count: 0 };
                metrics.forEach(m => countryStats[country][m.key] = 0);
            }
            countryStats[country].count++;
            metrics.forEach(m => {
                countryStats[country][m.key] += +d[m.key] || 0;
            });
        });
    });
    Object.keys(countryStats).forEach(country => {
        metrics.forEach(m => {
            countryStats[country][m.key] /= countryStats[country].count;
        });
    });
    // 2. 取UK和其他国家的四维向量
    function getVec(country) {
        return metrics.map(m => countryStats[country] ? countryStats[country][m.key] : 0);
    }
    const ukVec = getVec('UK');
    // 3. 计算余弦相似度
    function cosineSimilarity(a, b) {
        const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
        const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
        const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
        return normA && normB ? dot / (normA * normB) : 0;
    }
    // 4. 归一化到0.2~1.0
    let sims = countries.filter(c => c.code !== 'UK').map(c => cosineSimilarity(ukVec, getVec(c.code)));
    const minSim = Math.min(...sims), maxSim = Math.max(...sims);
    function normSim(sim) {
        if (maxSim === minSim) return 1.0;
        return 0.2 + 0.8 * (sim - minSim) / (maxSim - minSim);
    }
    // 5. 构造links，使用用户给定的 similarity
    const simMap = {
        'DE': 0.56,
        'FR': 0.7,
        'IT': 0.72,
        'SK': 0.69,
        'SE': 0.82,
        'PL': 0.76,
        'NL': 0.65,
        'PT': 0.75
    };
    const links = countries.filter(c => c.code !== 'UK').map((c, i) => ({
        source: 'UK',
        target: c.code,
        similarity: simMap[c.code] || 0.5,
        name: c.name
    }));
    // SVG setup
    const width = 400, height = 400, center = { x: width/2, y: height/2 };
    d3.select('#networkFlowerChart').selectAll('*').remove();
    const svg = d3.select('#networkFlowerChart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    // Layout: UK center, others in circle
    const radius = 140;
    const angleStep = 2 * Math.PI / (countries.length - 1);
    const nodePos = { UK: center };
    countries.slice(1).forEach((c, i) => {
        nodePos[c.code] = {
            x: center.x + radius * Math.cos(i * angleStep - Math.PI/2),
            y: center.y + radius * Math.sin(i * angleStep - Math.PI/2)
        };
    });
    // Draw links
    const colorScale = d3.scaleLinear().domain([0.2, 1.0]).range(['#b6b7d8', '#1e3a8a']);
    const widthScale = d3.scaleLinear().domain([0.2, 1.0]).range([1, 14]);
    svg.selectAll('.link')
        .data(links)
        .enter()
        .append('line')
        .attr('class', 'link')
        .attr('x1', center.x)
        .attr('y1', center.y)
        .attr('x2', d => nodePos[d.target].x)
        .attr('y2', d => nodePos[d.target].y)
        .attr('stroke', d => colorScale(d.similarity))
        .attr('stroke-width', d => widthScale(d.similarity))
        .attr('opacity', 0.7);
    // Draw country nodes (flag + rail icon)
    const nodeG = svg.selectAll('.node')
        .data(countries)
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', d => `translate(${nodePos[d.code].x},${nodePos[d.code].y})`);
    // Draw flag (oval)
    nodeG.append('ellipse')
        .attr('rx', 18)
        .attr('ry', 13)
        .attr('fill', '#fff')
        .attr('stroke', '#b6b7d8')
        .attr('stroke-width', 2);
    nodeG.append('image')
        .attr('x', -16)
        .attr('y', -11)
        .attr('width', 32)
        .attr('height', 22)
        .attr('href', d => `assets/images/${d.code.toLowerCase()}-flag.png`)
        .attr('clip-path', null);
    // Draw rail icon below flag
    nodeG.append('image')
        .attr('x', -10)
        .attr('y', 10)
        .attr('width', 20)
        .attr('height', 20)
        .attr('href', 'assets/images/rail-icon.png');
    // Draw country code below (except for center UK)
    nodeG.filter(d => d.code !== 'UK')
        .append('text')
        .attr('y', 38)
        .attr('text-anchor', 'middle')
        .attr('font-size', '0.85rem')
        .attr('font-family', 'PT Serif, serif')
        .attr('fill', '#222')
        .attr('font-weight', 400)
        .text(d => d.code);
    // Center label
    svg.append('text')
        .attr('x', center.x)
        .attr('y', center.y - 24)
        .attr('text-anchor', 'middle')
        .attr('font-size', '1.3rem')
        .attr('font-family', 'Playfair Display, serif')
        .attr('font-weight', 700)
        .attr('fill', '#222')
        .text('UK');
    // Tooltip
    let tooltip = d3.select('#networkFlowerTooltip');
    if (tooltip.empty()) {
        tooltip = d3.select('body').append('div')
            .attr('id', 'networkFlowerTooltip')
            .attr('class', 'radial-tooltip')
            .style('opacity', 0);
    }
    svg.selectAll('.link')
        .on('mouseover', function(event, d) {
            d3.select(this).attr('stroke-width', widthScale(d.similarity) + 2);
            tooltip.html(`<div class='tooltip-header'>${d.name}</div><div class='tooltip-content'>Similarity to UK: <b>${d.similarity.toFixed(2)}</b></div>`)
                .style('left', (event.pageX + 16) + 'px')
                .style('top', (event.pageY - 16) + 'px')
                .style('opacity', 1)
                .classed('visible', true);
        })
        .on('mouseout', function() {
            d3.select(this).attr('stroke-width', d => widthScale(d.similarity));
            tooltip.style('opacity', 0);
        });
    nodeG.on('mouseover', function(event, d) {
        if (d.code !== 'UK') {
            const link = links.find(l => l.target === d.code);
            tooltip.html(`<div class='tooltip-header'>${d.name}</div><div class='tooltip-content'>Similarity to UK: <b>${link.similarity.toFixed(2)}</b></div>`)
                .style('left', (event.pageX + 16) + 'px')
                .style('top', (event.pageY - 16) + 'px')
                .style('opacity', 1)
                .classed('visible', true);
        }
    }).on('mouseout', function() {
        tooltip.style('opacity', 0);
    });
}

// Animated globe with train
function createNetworkGlobeAnim() {
    const width = 125, height = 240, r = 60;
    const trainOffsetX = -70, trainOffsetY = -10;
    d3.select('#networkGlobeAnim').selectAll('*').remove();
    const svg = d3.select('#networkGlobeAnim')
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    // Draw earth image
    svg.append('image')
        .attr('x', width/2 - r)
        .attr('y', height/2 - r)
        .attr('width', r * 2)
        .attr('height', r * 2)
        .attr('href', 'assets/images/earth.png');
    // Draw longitude/latitude lines
    for (let i = 0; i < 6; i++) {
        const angle = Math.PI * i / 6;
        svg.append('line')
            .attr('x1', width/2 + r * Math.cos(angle))
            .attr('y1', height/2 + r * Math.sin(angle))
            .attr('x2', width/2 - r * Math.cos(angle))
            .attr('y2', height/2 - r * Math.sin(angle))
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.2)
            .attr('opacity', 0.7);
    }
    for (let i = 1; i <= 2; i++) {
        svg.append('ellipse')
            .attr('cx', width/2)
            .attr('cy', height/2)
            .attr('rx', r)
            .attr('ry', r * (0.5 + 0.2 * i))
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.2)
            .attr('fill', 'none')
            .attr('opacity', 0.7);
    }
    // Train icon
    const trainW = 32, trainH = 32;
    const train = svg.append('image')
        .attr('width', trainW)
        .attr('height', trainH)
        .attr('href', 'assets/images/train-icon.png')
        .attr('x', width/2 + r - trainW/2 - 40)
        .attr('y', height/2 - trainH/2 - 95);
    // Animate train along equator
    function animateTrain() {
        train.transition()
            .duration(4000)
            .ease(d3.easeLinear)
            .attrTween('transform', function() {
                return function(t) {
                    const angle = 2 * Math.PI * t;
                    const x = width/2 + r * Math.cos(angle) - trainW/2 + trainOffsetX;
                    const y = height/2 + r * Math.sin(angle) - trainH/2 + trainOffsetY;
                    return `translate(${x},${y})`;
                };
            })
            .on('end', animateTrain);
    }
    animateTrain();
}

// Scatter Plot for Price vs Punctuality
async function createScatterPlot() {
    const data = await d3.csv("data/european_train_punctuality.csv");
    
    // Calculate UK average
    const ukOperators = data.filter(d => d.Country === "UK");
    const ukAverage = {
        "Ticket Price (€/km)": d3.mean(ukOperators, d => +d["Ticket Price (€/km)"]),
        "Punctuality (%)": d3.mean(ukOperators, d => +d["Punctuality (%)"])
    };
    
    // Calculate EU average (excluding UK)
    const euOperators = data.filter(d => d.Country !== "UK");
    const euAverage = {
        "Ticket Price (€/km)": d3.mean(euOperators, d => +d["Ticket Price (€/km)"]),
        "Punctuality (%)": d3.mean(euOperators, d => +d["Punctuality (%)"])
    };

    // Set up dimensions
    const margin = {top: 40, right: 40, bottom: 60, left: 60};
    const width = document.getElementById("scatterPlot").clientWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select("#scatterPlot")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create scales
    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => +d["Ticket Price (€/km)"]) * 1.1])
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([60, d3.max(data, d => +d["Punctuality (%)"]) * 1.1])
        .range([height, 0]);

    // Add axes
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5))
        .selectAll("text")
        .style("font-family", "PT Serif")
        .style("font-size", "0.9rem");

    svg.append("g")
        .call(d3.axisLeft(y).ticks(5))
        .selectAll("text")
        .style("font-family", "PT Serif")
        .style("font-size", "0.9rem");

    // Add axis labels with icons
    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", width/2)
        .attr("y", height + 40)
        .attr("text-anchor", "middle")
        .html("Ticket Price (€/km) 💰");

    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height/2)
        .attr("y", -40)
        .attr("text-anchor", "middle")
        .html("Punctuality (%) 🚂");

    // Add dots
    svg.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("class", "dot")
        .attr("cx", d => x(+d["Ticket Price (€/km)"]))
        .attr("cy", d => y(+d["Punctuality (%)"]))
        .attr("r", 20) // Increased from 4 to 7
        .style("fill", d => d.Country === "UK" ? "#6668b5" : "#b6b7d8")
        .style("opacity", 0.7)
        .on("mouseover", function(event, d) {
            d3.select(this).style("opacity", 1);
            d3.select("#scatterTooltip")
                .style("opacity", 1)
                .html(`
                    <strong>${d.Operator}</strong><br>
                    Price: €${(+d["Ticket Price (€/km)"]).toFixed(2)}/km<br>
                    Punctuality: ${(+d["Punctuality (%)"]).toFixed(1)}%
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).style("opacity", 0.7);
            d3.select("#scatterTooltip").style("opacity", 0);
        });

    // Add UK average
    svg.append("circle")
        .attr("cx", x(ukAverage["Ticket Price (€/km)"]))
        .attr("cy", y(ukAverage["Punctuality (%)"]))
        .attr("r", 6)
        .style("fill", "#6668b5")
        .style("stroke", "#fff")
        .style("stroke-width", 2);

    // Add EU average
    svg.append("circle")
        .attr("cx", x(euAverage["Ticket Price (€/km)"]))
        .attr("cy", y(euAverage["Punctuality (%)"]))
        .attr("r", 6)
        .style("fill", "#b6b7d8")
        .style("stroke", "#fff")
        .style("stroke-width", 2);

    // Add legend
    const legend = svg.append("g")
        .attr("transform", `translate(${width - 100}, 20)`);

    legend.append("circle")
        .attr("cx", 0)
        .attr("cy", 0)
        .attr("r", 4)
        .style("fill", "#b6b7d8");

    legend.append("text")
        .attr("x", 15)
        .attr("y", 4)
        .text("EU Operators")
        .style("font-family", "PT Serif")
        .style("font-size", "0.9rem");

    legend.append("circle")
        .attr("cx", 0)
        .attr("cy", 20)
        .attr("r", 4)
        .style("fill", "#6668b5");

    legend.append("text")
        .attr("x", 15)
        .attr("y", 24)
        .text("UK Operators")
        .style("font-family", "PT Serif")
        .style("font-size", "0.9rem");
}

// Radar Chart for Service Dimension Comparison (UK vs EU Average)
async function createServiceRadarChart() {
    const data = await d3.csv("data/european_train_punctuality.csv");
    // 1. 维度
    const metrics = [
        { key: "Punctuality (%)", label: "Punctuality" },
        { key: "Ticket Price (€/km)", label: "Ticket Price" },
        { key: "Compensation Policy Score (/10)", label: "Compensation" },
        { key: "Night Train Offer Score (/10)", label: "Night Service" }
    ];
    // 2. UK & EU average
    const uk = {};
    const eu = {};
    metrics.forEach(m => {
        uk[m.key] = d3.mean(data.filter(d => d.Country === "UK"), d => +d[m.key]);
        eu[m.key] = d3.mean(data.filter(d => d.Country !== "UK"), d => +d[m.key]);
    });
    // 3. 标准化（票价反向，其他正向，全部归一到0-1）
    // 票价最大最小
    const priceExtent = d3.extent(data, d => +d["Ticket Price (€/km)"]);
    function norm(val, min, max) { return (val - min) / (max - min); }
    function normReverse(val, min, max) { return 1 - (val - min) / (max - min); }
    const ukNorm = [
        norm(uk["Punctuality (%)"], 60, 100),
        normReverse(uk["Ticket Price (€/km)"], priceExtent[0], priceExtent[1]),
        uk["Compensation Policy Score (/10)"] / 10,
        uk["Night Train Offer Score (/10)"] / 10
    ];
    const euNorm = [
        norm(eu["Punctuality (%)"], 60, 100),
        normReverse(eu["Ticket Price (€/km)"], priceExtent[0], priceExtent[1]),
        eu["Compensation Policy Score (/10)"] / 10,
        eu["Night Train Offer Score (/10)"] / 10
    ];
    // 4. 绘制雷达图
    const w = 350, h = 350, radius = 120, cx = w/2, cy = h/2;
    d3.select('#serviceRadarChart').selectAll('*').remove();
    const svg = d3.select('#serviceRadarChart')
        .append('svg')
        .attr('width', w)
        .attr('height', h);
    // 角度
    const angle = (i) => (Math.PI*2/metrics.length)*i - Math.PI/2;
    // 网格
    for(let r=0.25; r<=1; r+=0.25) {
        svg.append('polygon')
            .attr('points', metrics.map((m,i) => [cx + Math.cos(angle(i))*radius*r, cy + Math.sin(angle(i))*radius*r].join(",")).join(' '))
            .attr('fill', 'none')
            .attr('stroke', '#b6b7d8')
            .attr('stroke-width', 1)
            .attr('opacity', 0.5);
    }
    // 轴线
    metrics.forEach((m,i) => {
        svg.append('line')
            .attr('x1', cx)
            .attr('y1', cy)
            .attr('x2', cx + Math.cos(angle(i))*radius)
            .attr('y2', cy + Math.sin(angle(i))*radius)
            .attr('stroke', '#b6b7d8')
            .attr('stroke-width', 1.2)
            .attr('opacity', 0.7);
    });
    // 轴标签
    metrics.forEach((m,i) => {
        svg.append('text')
            .attr('x', cx + Math.cos(angle(i))*(radius+18))
            .attr('y', cy + Math.sin(angle(i))*(radius+18) + 5)
            .attr('text-anchor', 'middle')
            .attr('font-family', 'PT Serif, serif')
            .attr('font-size', '0.75rem') // Reduced font size
            .attr('fill', '#222')
            .style('cursor', 'pointer')
            .text(m.label)
            .on('mouseover', function(event) {
                // Create or select tooltip
                let tooltip = d3.select('#serviceRadarTooltip');
                if (tooltip.empty()) {
                    tooltip = d3.select('body').append('div')
                        .attr('id', 'serviceRadarTooltip')
                        .attr('class', 'radial-tooltip')
                        .style('position', 'absolute')
                        .style('pointer-events', 'none')
                        .style('background', 'rgba(255,255,255,0.97)')
                        .style('border-radius', '6px')
                        .style('box-shadow', '0 2px 8px rgba(0,0,0,0.13)')
                        .style('padding', '12px 18px')
                        .style('font-family', 'PT Serif, serif')
                        .style('font-size', '0.95rem')
                        .style('color', '#222');
                }
                // Format values
                let ukVal = uk[m.key];
                let euVal = eu[m.key];
                let ukShow = m.key === 'Ticket Price (€/km)' ? `€${ukVal.toFixed(2)}/km` : m.key.includes('Score') ? ukVal.toFixed(2) : ukVal.toFixed(1) + '%';
                let euShow = m.key === 'Ticket Price (€/km)' ? `€${euVal.toFixed(2)}/km` : m.key.includes('Score') ? euVal.toFixed(2) : euVal.toFixed(1) + '%';
                tooltip.html(`
                    <div style='font-weight:700; margin-bottom:4px;'>${m.label}</div>
                    <div style='margin-bottom:2px;'><span style='color:#e63946;font-weight:600;'>UK:</span> ${ukShow}</div>
                    <div><span style='color:#8e8fc7;font-weight:600;'>EU Avg:</span> ${euShow}</div>
                `)
                .style('left', (event.pageX + 14) + 'px')
                .style('top', (event.pageY - 18) + 'px')
                .style('opacity', 1)
                .style('z-index', 9999);
            })
            .on('mousemove', function(event) {
                d3.select('#serviceRadarTooltip')
                    .style('left', (event.pageX + 14) + 'px')
                    .style('top', (event.pageY - 18) + 'px');
            })
            .on('mouseout', function() {
                d3.select('#serviceRadarTooltip').style('opacity', 0);
            });
    });
    // EU 区域
    svg.append('polygon')
        .attr('points', euNorm.map((v,i) => [cx + Math.cos(angle(i))*radius*v, cy + Math.sin(angle(i))*radius*v].join(",")).join(' '))
        .attr('fill', '#8e8fc7')
        .attr('opacity', 0.25)
        .attr('stroke', '#8e8fc7')
        .attr('stroke-width', 2);
    // UK 区域
    svg.append('polygon')
        .attr('points', ukNorm.map((v,i) => [cx + Math.cos(angle(i))*radius*v, cy + Math.sin(angle(i))*radius*v].join(",")).join(' '))
        .attr('fill', '#e63946')
        .attr('opacity', 0.25)
        .attr('stroke', '#e63946')
        .attr('stroke-width', 2);
    // 图例
    svg.append('circle').attr('cx', 30).attr('cy', 30).attr('r', 7).attr('fill', '#e63946').attr('opacity', 0.5);
    svg.append('text').attr('x', 45).attr('y', 35).text('UK').attr('font-size', '1rem').attr('fill', '#e63946').attr('font-family', 'PT Serif, serif');
    svg.append('circle').attr('cx', 30).attr('cy', 55).attr('r', 7).attr('fill', '#8e8fc7').attr('opacity', 0.5);
    svg.append('text').attr('x', 45).attr('y', 60).text('EU Avg').attr('font-size', '1rem').attr('fill', '#8e8fc7').attr('font-family', 'PT Serif, serif');
}

// Initialize visualization
async function initialize() {
    try {
        console.log('Initializing visualization...');
        const { countryData, geoData } = await loadData();
        
        // Calculate and display statistics first
        calculateStatistics(countryData);
        
        const colorScale = createColorScale();
        
        // Create map visualization
        const mapContainer = document.getElementById('mapChart');
        if (!mapContainer) {
            throw new Error('Map container not found');
        }
        const mapControls = createMap(mapContainer, geoData, countryData, colorScale);

        // Initialize with UK data
        if (countryData.has('UK')) {
            const ukOperators = countryData.get('UK');
            const ukDetails = {
                punctuality: d3.mean(ukOperators, d => d.punctuality),
                cancellation: d3.mean(ukOperators, d => d.cancellation),
                price: d3.mean(ukOperators, d => d.ticketPrice),
                operators: ukOperators.length
            };
            updateCountryDetails('UK', ukDetails, ukOperators);
        }

        // Create cancellation chart
        d3.csv('data/european_train_punctuality.csv').then(data => {
            createCancellationChart(data);
            createRadialChart(data);
            createBubbleGridChart(data);
            createNetworkFlowerChart(data);
            createNetworkGlobeAnim();
        });

        // Create scatter plot
        createScatterPlot();

        // Create service radar chart
        createServiceRadarChart();

        console.log('Visualization initialized successfully');
    } catch (error) {
        console.error('Error initializing visualization:', error);
        const mapContainer = document.getElementById('mapChart');
        if (mapContainer) {
            mapContainer.innerHTML = `
                <div style="padding: 20px; text-align: center; color: red;">
                    Error loading map. Please check the console for details.
                </div>
            `;
        }
    }
}

// Start the visualization when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting initialization...');
    initialize();
});

// --- Journey Trend Chart with Filter ---
let journeyData = [];
let journeyFilters = { time: 'ALL' };

function applyJourneyTimeFilter(data) {
    if (journeyFilters.time !== 'ALL') {
        return data.filter(d => {
            const hour = parseInt((d['Departure Time']||'').split(':')[0]);
            switch(journeyFilters.time) {
                case 'AM': return hour >= 0 && hour < 12;
                case 'PM': return hour >= 12 && hour < 24;
                case 'Peak': return (hour >= 6 && hour < 9) || (hour >= 16 && hour < 19);
                case 'Off-Peak': return (hour < 6 || hour >= 9) && (hour < 16 || hour >= 19);
                default: return true;
            }
        });
    }
    return data;
}

function drawJourneyTrend(data) {
    const svgId = '#chart-journey-trend';
    d3.select(svgId).selectAll('*').remove();
    // 按月统计
    const monthMap = {};
    data.forEach(row => {
        const date = row['Date of Journey'];
        if (!date) return;
        const month = date.slice(0,7); // yyyy-mm
        monthMap[month] = (monthMap[month] || 0) + 1;
    });
    const months = Object.keys(monthMap).sort();
    const values = months.map(m => monthMap[m]);
    // 英文月份缩写
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthLabels = months.map(m => monthNames[parseInt(m.slice(5,7))-1]);
    // 统计
    const total = d3.sum(values);
    const maxIdx = values.indexOf(d3.max(values));
    const minIdx = values.indexOf(d3.min(values));
    const change = values.length > 1 ? ((values[values.length-1]-values[0])/values[0]*100) : 0;
    // 取消数
    const cancelled = data.filter(row => row['Journey Status'] && row['Journey Status'].toLowerCase().includes('cancel')).length;
    // 更新统计区
    d3.select('#journey-total').text(total.toLocaleString());
    d3.select('#journey-cancelled').text(cancelled.toLocaleString());
    // 更新说明区
    let desc = `From ${monthLabels[0]} to ${monthLabels[monthLabels.length-1]} 2024, the total actual passenger rail journeys were <b>${total.toLocaleString()}</b>, with the highest in <b>${monthLabels[maxIdx]}</b> and the lowest in <b>${monthLabels[minIdx]}</b>, resulting in a <b>${change>=0?'+':''}${change.toFixed(2)}%</b> ${change>=0?'increase':'decrease'} overall.`;
    d3.select('#journey-desc').html(desc);
    // 绘制折线图
    const width = 420, height = 220, margin = {top: 50, right: 30, bottom: 40, left: 60};
    const svg = d3.select(svgId).append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMinYMin meet');
    const x = d3.scalePoint().domain(months).range([margin.left, width-margin.right]);
    // 让折线波动更大：y 轴 domain 只包住数据区间
    const minY = Math.min(...values);
    const maxY = Math.max(...values);
    const y = d3.scaleLinear().domain([minY * 0.98, maxY * 1.02]).range([height-margin.bottom, margin.top]);
    // 区域阴影
    svg.append('path')
        .datum(values)
        .attr('fill','#e0e7ef')
        .attr('opacity',0.7)
        .attr('stroke','none')
        .attr('d',d3.area().x((d,i)=>x(months[i])).y0(y(minY * 0.98)).y1(d=>y(d)));
    // 轴
    svg.append('g').attr('transform',`translate(0,${height-margin.bottom})`).call(d3.axisBottom(x).tickFormat((d,i)=>monthLabels[i])).selectAll('text')
        .style('font-family','Georgia,Times New Roman,serif').style('font-size','13px').style('fill','#222');
    // 折线
    svg.append('path')
        .datum(values)
        .attr('fill','none')
        .attr('stroke','#1e3a8a')
        .attr('stroke-width',4)
        .attr('d',d3.line().x((d,i)=>x(months[i])).y(d=>y(d)).curve(d3.curveMonotoneX));
    // 数据点
    svg.selectAll('circle')
        .data(values)
        .enter().append('circle')
        .attr('cx',(d,i)=>x(months[i]))
        .attr('cy',d=>y(d))
        .attr('r',6)
        .attr('fill','#1e3a8a')
        .attr('stroke','#1e3a8a')
        .attr('stroke-width',2)
        .on('mouseover', function(event, d) {
            // Tooltip
            let tooltip = d3.select('#journeyTrendTooltip');
            if (tooltip.empty()) {
                tooltip = d3.select('body').append('div')
                    .attr('id', 'journeyTrendTooltip')
                    .attr('class', 'radial-tooltip')
                    .style('position', 'absolute')
                    .style('pointer-events', 'none')
                    .style('background', 'rgba(255,255,255,0.98)')
                    .style('border', '1px solid #e5e7eb')
                    .style('border-radius', '4px')
                    .style('padding', '10px 16px')
                    .style('font-family', 'PT Serif, serif')
                    .style('font-size', '1rem')
                    .style('color', '#222')
                    .style('z-index', 1000);
            }
            const i = values.indexOf(d);
            tooltip.html(`<b>${monthLabels[i]} 2024</b><br>Journeys: <b>${d.toLocaleString()}</b>`)
                .style('left', (event.pageX + 14) + 'px')
                .style('top', (event.pageY - 18) + 'px')
                .style('opacity', 1);
            d3.select(this).attr('fill', '#ffe69c');
        })
        .on('mousemove', function(event) {
            d3.select('#journeyTrendTooltip')
                .style('left', (event.pageX + 14) + 'px')
                .style('top', (event.pageY - 18) + 'px');
        })
        .on('mouseout', function() {
            d3.select('#journeyTrendTooltip').style('opacity', 0);
            d3.select(this).attr('fill', '#1e3a8a');
        });
    // 上下箭头和百分比
    for(let i=1;i<values.length;i++){
        const prev = values[i-1], curr = values[i];
        const x0 = x(months[i]), y0 = y(curr);
        const up = curr>prev;
        const pct = prev ? ((curr-prev)/prev*100).toFixed(1) : '0.0';
        svg.append('text')
            .attr('x',x0)
            .attr('y',y0-18)
            .attr('text-anchor','middle')
            .attr('font-size','14px')
            .attr('font-family','Georgia,Times New Roman,serif')
            .attr('font-weight','bold')
            .attr('fill',up?'#22c55e':'#ef4444')
            .text(up?'▲':'▼');
        svg.append('text')
            .attr('x',x0)
            .attr('y',y0-10)
            .attr('text-anchor','middle')
            .attr('font-size','13px')
            .attr('font-family','Georgia,Times New Roman,serif')
            .attr('fill',up?'#22c55e':'#ef4444')
            .text(`${up?'+':''}${pct}%`);
    }
    // 数值标签
    svg.selectAll('text.value-label')
        .data(values)
        .enter().append('text')
        .attr('class','value-label')
        .attr('x',(d,i)=>x(months[i]))
        .attr('y',d=>y(d)-30)
        .attr('text-anchor','middle')
        .attr('font-size','15px')
        .attr('font-family','Georgia,Times New Roman,serif')
        .attr('fill','#222')
        .attr('font-weight','bold')
        .text(d=>d.toLocaleString());
}

function updateJourneyTrend() {
    drawJourneyTrend(applyJourneyTimeFilter(journeyData));
}

// 绑定按钮事件
function setupJourneyTrendFilter() {
    d3.selectAll('#timeFilterGroup .time-filter-btn').on('click', function() {
        d3.selectAll('#timeFilterGroup .time-filter-btn').classed('active', false);
        d3.select(this).classed('active', true);
        journeyFilters.time = d3.select(this).text();
        updateJourneyTrend();
    });
}

// 加载数据并初始化
function initJourneyTrend() {
    d3.csv('data/railway.csv').then(data => {
        journeyData = data;
        setupJourneyTrendFilter();
        updateJourneyTrend();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...
    initJourneyTrend();
});

function drawRailcardDist(data) {
  const svgId = '#chart-railcard';
  d3.select(svgId).selectAll('*').remove();
  // 统计
  const total = data.length;
  const nonRailcard = data.filter(d => !d['Railcard'] || d['Railcard']==='None').length;
  const railcard = total - nonRailcard;
  // Railcard持有者细分
  const rcTypes = ['Adult','Disabled','Senior'];
  const rcCounts = rcTypes.map(type => data.filter(d => d['Railcard']===type).length);
  // SVG布局
  const width = 520, height = 240;
  const donutR = 62, donutCx = 160, donutCy = height/2 - 10;
  const barW = 48, barGap = 38, barBaseX = 320, barBaseY = 180, barMaxH = 110;
  const svg = d3.select(svgId).append('svg')
    .attr('width','100%')
    .attr('height',height)
    .attr('viewBox',`0 0 ${width} ${height}`)
    .attr('preserveAspectRatio','xMinYMin meet');
  // Donut chart
  const pie = d3.pie().value(d=>d.v);
  const donutData = [
    {key:'Non Railcard Holder', v:nonRailcard, color:'#1e3a8a'},
    {key:'Railcard Holder', v:railcard, color:'#b6b7d8'}
  ];
  const arc = d3.arc().innerRadius(donutR-28).outerRadius(donutR);
  const arcOuter = d3.arc().innerRadius(donutR+6).outerRadius(donutR+6);
  const gDonut = svg.append('g').attr('transform',`translate(${donutCx},${donutCy})`);
  // Draw arcs
  gDonut.selectAll('path')
    .data(pie(donutData))
    .enter().append('path')
    .attr('d',arc)
    .attr('fill',d=>d.data.color)
    .attr('stroke','#fff')
    .attr('stroke-width',1.5)
    .style('cursor','pointer')
    .on('mouseover',function(e,d){
      d3.select(this).attr('opacity',0.7);
      // Tooltip for donut
      let tooltip = d3.select('#railcardDonutTooltip');
      if (tooltip.empty()) {
        tooltip = d3.select('body').append('div')
          .attr('id', 'railcardDonutTooltip')
          .attr('class', 'radial-tooltip')
          .style('position', 'absolute')
          .style('pointer-events', 'none')
          .style('background', 'rgba(255,255,255,0.98)')
          .style('border', '1px solid #e5e7eb')
          .style('border-radius', '4px')
          .style('padding', '10px 16px')
          .style('font-family', 'PT Serif, serif')
          .style('font-size', '1rem')
          .style('color', '#222')
          .style('z-index', 1000);
      }
      const value = d.data.v.toLocaleString();
      const pct = `${Math.round(d.data.v/total*100)}%`;
      tooltip.html(`<b>${d.data.key}</b><br>Count: <b>${value}</b><br>Percent: <b>${pct}</b>`)
        .style('left', (e.pageX + 14) + 'px')
        .style('top', (e.pageY - 18) + 'px')
        .style('opacity', 1);
    })
    .on('mousemove',function(e){
      d3.select('#railcardDonutTooltip')
        .style('left', (e.pageX + 14) + 'px')
        .style('top', (e.pageY - 18) + 'px');
    })
    .on('mouseout',function(e,d){
      d3.select(this).attr('opacity',1);
      d3.select('#railcardDonutTooltip').style('opacity', 0);
    });
  // Donut leader lines and labels
  gDonut.selectAll('polyline')
    .data(pie(donutData))
    .enter().append('polyline')
    .attr('points', function(d) {
      const pos = arcOuter.centroid(d);
      const midAngle = (d.startAngle + d.endAngle) / 2;
      const x = pos[0] + (midAngle < Math.PI ? 24 : -24);
      return [arc.centroid(d), arcOuter.centroid(d), [x, pos[1]]];
    })
    .attr('fill', 'none')
    .attr('stroke', '#222')
    .attr('stroke-width', 1.5);
  gDonut.selectAll('donut-label')
    .data(pie(donutData))
    .enter().append('text')
    .attr('x', function(d) {
      const pos = arcOuter.centroid(d);
      const midAngle = (d.startAngle + d.endAngle) / 2;
      return pos[0] + (midAngle < Math.PI ? 28 : -28);
    })
    .attr('y', function(d) {
      const pos = arcOuter.centroid(d);
      return pos[1] - 2;
    })
    .attr('text-anchor', function(d) {
      const midAngle = (d.startAngle + d.endAngle) / 2;
      return midAngle < Math.PI ? 'start' : 'end';
    })
    .attr('font-size','14px')
    .attr('font-family','Georgia,Times New Roman,serif')
    .attr('font-weight','bold')
    .attr('fill','#222')
    .each(function(d) {
      const value = d.data.v.toLocaleString();
      const pct = `${Math.round(d.data.v/total*100)}%`;
      d3.select(this)
        .append('tspan')
        .attr('x', d3.select(this).attr('x'))
        .attr('dy', 0)
        .text(value);
      d3.select(this)
        .append('tspan')
        .attr('x', d3.select(this).attr('x'))
        .attr('dy', '1.2em')
        .attr('font-size','13px')
        .attr('font-weight','normal')
        .text(pct);
    });
  // Donut legend below (move up)
  svg.append('circle').attr('cx',donutCx-32).attr('cy',height-40).attr('r',8).attr('fill','#1e3a8a');
  svg.append('text').attr('x',donutCx-18).attr('y',height-34).attr('font-size','15px').attr('fill','#222').text('Non Railcard Holder');
  svg.append('circle').attr('cx',donutCx-32).attr('cy',height-20).attr('r',8).attr('fill','#b6b7d8');
  svg.append('text').attr('x',donutCx-18).attr('y',height-14).attr('font-size','15px').attr('fill','#222').text('Railcard Holder');
  // Bar chart
  const maxBar = d3.max(rcCounts) || 1;
  rcTypes.forEach((type,i)=>{
    const x = barBaseX + i*(barW+barGap);
    const h = rcCounts[i]/maxBar*barMaxH;
    svg.append('rect')
      .attr('x',x)
      .attr('y',barBaseY-h)
      .attr('width',barW)
      .attr('height',h)
      .attr('fill','#b6b7d8')
      .attr('stroke','#888')
      .attr('cursor','pointer')
      .on('mouseover',function(e){
        d3.select(this).attr('fill','#1e3a8a');
        // Tooltip for bar
        let tooltip = d3.select('#railcardBarTooltip');
        if (tooltip.empty()) {
          tooltip = d3.select('body').append('div')
            .attr('id', 'railcardBarTooltip')
            .attr('class', 'radial-tooltip')
            .style('position', 'absolute')
            .style('pointer-events', 'none')
            .style('background', 'rgba(255,255,255,0.98)')
            .style('border', '1px solid #e5e7eb')
            .style('border-radius', '4px')
            .style('padding', '10px 16px')
            .style('font-family', 'PT Serif, serif')
            .style('font-size', '1rem')
            .style('color', '#222')
            .style('z-index', 1000);
        }
        const value = rcCounts[i].toLocaleString();
        const pct = `${Math.round(rcCounts[i]/total*100)}%`;
        tooltip.html(`<b>${type} Railcard</b><br>Count: <b>${value}</b><br>Percent: <b>${pct}</b>`)
          .style('left', (e.pageX + 14) + 'px')
          .style('top', (e.pageY - 18) + 'px')
          .style('opacity', 1);
      })
      .on('mousemove',function(e){
        d3.select('#railcardBarTooltip')
          .style('left', (e.pageX + 14) + 'px')
          .style('top', (e.pageY - 18) + 'px');
      })
      .on('mouseout',function(){
        d3.select(this).attr('fill','#b6b7d8');
        d3.select('#railcardBarTooltip').style('opacity', 0);
      });
    // Bar value + percent (above bar)
    svg.append('text')
      .attr('x',x+barW/2)
      .attr('y',barBaseY-h-12)
      .attr('text-anchor','middle')
      .attr('font-size','16px')
      .attr('font-family','Georgia,Times New Roman,serif')
      .attr('font-weight','bold')
      .attr('fill','#222')
      .text(`${rcCounts[i].toLocaleString()} ${Math.round(rcCounts[i]/total*100)}%`);
    // Bar label
    svg.append('text')
      .attr('x',x+barW/2)
      .attr('y',barBaseY+24)
      .attr('text-anchor','middle')
      .attr('font-size','16px')
      .attr('font-family','Georgia,Times New Roman,serif')
      .attr('fill','#222')
      .text(type);
  });
  // 动态描述
  const nonPct = Math.round(nonRailcard/total*100), rcPct = 100-nonPct;
  const desc = `<span style=\"font-size:1.15em;\">${nonPct>=rcPct?`<b>${nonPct}%</b> of the passengers do <b>not use a railcard</b> and the <b>Adult</b> railcard holders are the most popular among the railcard holders.`:`<b>${rcPct}%</b> of the passengers use a railcard and the <b>Adult</b> railcard holders are the most popular among the railcard holders.`}</span>`;
  d3.select('#railcard-desc').html(desc);
}

function updateRailcardDist() {
  drawRailcardDist(applyJourneyTimeFilter(journeyData));
}

// 修改 filter 联动
function setupRailcardFilter() {
  // 目前只和时间 filter 联动
  // 若有更多 filter 可在此扩展
}

// 在主初始化中调用
function initRailcardDist() {
  // 数据已在 journeyData 加载
  updateRailcardDist();
}

// 在主 DOMContentLoaded 里加
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...
    initRailcardDist();
    // 联动
    d3.selectAll('#timeFilterGroup .time-filter-btn').on('click.railcard', function() {
      updateRailcardDist();
    });
  });
}

// --- Ticket Type Distribution Chart ---
function drawTicketTypeDist(data) {
  const svgId = '#chart-ticket-type';
  d3.select(svgId).selectAll('*').remove();
  // 只统计有票种的
  const validClass = ['Standard', 'First Class'];
  const classData = data.filter(d => validClass.includes(d['Ticket Class']));
  const total = classData.length;
  const classCounts = [
    {key:'Standard', v:classData.filter(d=>d['Ticket Class']==='Standard').length, color:'#1e3a8a'},
    {key:'First Class', v:classData.filter(d=>d['Ticket Class']==='First Class').length, color:'#b6b7d8'}
  ];
  // 只统计有票型的
  const typeKeys = ['Advance','Off-Peak','Anytime'];
  // SVG布局（与drawRailcardDist完全一致）
  const width = 520, height = 240;
  const donutR = 62, donutCx = 160, donutCy = height/2 - 10;
  const svg = d3.select(svgId).append('svg')
    .attr('width','100%')
    .attr('height',height)
    .attr('viewBox',`0 0 ${width} ${height}`)
    .attr('preserveAspectRatio','xMinYMin meet');
  // Donut chart
  const pie = d3.pie().value(d=>d.v);
  const donutData = classCounts;
  const arc = d3.arc().innerRadius(donutR-28).outerRadius(donutR);
  const arcOuter = d3.arc().innerRadius(donutR+6).outerRadius(donutR+6);
  const gDonut = svg.append('g').attr('transform',`translate(${donutCx},${donutCy})`);
  // Draw arcs
  gDonut.selectAll('path')
    .data(pie(donutData))
    .enter().append('path')
    .attr('d',arc)
    .attr('fill',d=>d.data.color)
    .attr('stroke','#fff')
    .attr('stroke-width',1.5)
    .style('cursor','pointer')
    .on('mouseover',function(e,d){
      d3.select(this).attr('opacity',0.7);
      // Tooltip for donut
      let tooltip = d3.select('#ticketTypeDonutTooltip');
      if (tooltip.empty()) {
        tooltip = d3.select('body').append('div')
          .attr('id', 'ticketTypeDonutTooltip')
          .attr('class', 'radial-tooltip')
          .style('position', 'absolute')
          .style('pointer-events', 'none')
          .style('background', 'rgba(255,255,255,0.98)')
          .style('border', '1px solid #e5e7eb')
          .style('border-radius', '4px')
          .style('padding', '10px 16px')
          .style('font-family', 'PT Serif, serif')
          .style('font-size', '1rem')
          .style('color', '#222')
          .style('z-index', 1000);
      }
      const value = d.data.v.toLocaleString();
      const pct = total > 0 ? `${Math.round(d.data.v/total*100)}%` : '0%';
      tooltip.html(`<b>${d.data.key}</b><br>Count: <b>${value}</b><br>Percent: <b>${pct}</b>`)
        .style('left', (e.pageX + 14) + 'px')
        .style('top', (e.pageY - 18) + 'px')
        .style('opacity', 1);
    })
    .on('mousemove',function(e){
      d3.select('#ticketTypeDonutTooltip')
        .style('left', (e.pageX + 14) + 'px')
        .style('top', (e.pageY - 18) + 'px');
    })
    .on('mouseout',function(e,d){
      d3.select(this).attr('opacity',1);
      d3.select('#ticketTypeDonutTooltip').style('opacity', 0);
    })
    .on('click',function(e,d){
      if(window.ticketTypeFilters && window.ticketTypeFilters.class===d.data.key){window.ticketTypeFilters.class=null;}else{window.ticketTypeFilters.class=d.data.key;}
      updateTicketTypeDist();
    });
  // Donut leader lines and labels
  gDonut.selectAll('polyline')
    .data(pie(donutData))
    .enter().append('polyline')
    .attr('points', function(d) {
      const pos = arcOuter.centroid(d);
      const midAngle = (d.startAngle + d.endAngle) / 2;
      const x = pos[0] + (midAngle < Math.PI ? 24 : -24);
      return [arc.centroid(d), arcOuter.centroid(d), [x, pos[1]]];
    })
    .attr('fill', 'none')
    .attr('stroke', '#222')
    .attr('stroke-width', 1.5);
  gDonut.selectAll('donut-label')
    .data(pie(donutData))
    .enter().append('text')
    .attr('x', function(d) {
      const pos = arcOuter.centroid(d);
      const midAngle = (d.startAngle + d.endAngle) / 2;
      return pos[0] + (midAngle < Math.PI ? 28 : -28);
    })
    .attr('y', function(d) {
      const pos = arcOuter.centroid(d);
      return pos[1] - 2;
    })
    .attr('text-anchor', function(d) {
      const midAngle = (d.startAngle + d.endAngle) / 2;
      return midAngle < Math.PI ? 'start' : 'end';
    })
    .attr('font-size','14px')
    .attr('font-family','Georgia,Times New Roman,serif')
    .attr('font-weight','bold')
    .attr('fill','#222')
    .each(function(d) {
      const value = d.data.v.toLocaleString();
      const pct = total > 0 ? `${Math.round(d.data.v/total*100)}%` : '0%';
      d3.select(this)
        .append('tspan')
        .attr('x', d3.select(this).attr('x'))
        .attr('dy', 0)
        .text(value);
      d3.select(this)
        .append('tspan')
        .attr('x', d3.select(this).attr('x'))
        .attr('dy', '1.2em')
        .attr('font-size','13px')
        .attr('font-weight','normal')
        .text(pct);
    });
  // Donut legend below (move up)
  svg.append('circle').attr('cx',donutCx-32).attr('cy',height-40).attr('r',8).attr('fill','#1e3a8a');
  svg.append('text').attr('x',donutCx-18).attr('y',height-34).attr('font-size','15px').attr('fill','#222').text('Standard');
  svg.append('circle').attr('cx',donutCx-32).attr('cy',height-20).attr('r',8).attr('fill','#b6b7d8');
  svg.append('text').attr('x',donutCx-18).attr('y',height-14).attr('font-size','15px').attr('fill','#222').text('First Class');
  // Bar chart
  const typeCounts = typeKeys.map(type=>data.filter(d=>d['Ticket Type']===type).length);
  const barW = 48, barGap = 38, barBaseX = 320, barBaseY = 180, barMaxH = 110;
  const maxBar = Math.max(...typeCounts, 1);
  typeKeys.forEach((type,i)=>{
    const x = barBaseX + i*(barW+barGap);
    const h = typeCounts[i]/maxBar*barMaxH;
    svg.append('rect')
      .attr('x',x)
      .attr('y',barBaseY-h)
      .attr('width',barW)
      .attr('height',h)
      .attr('fill','#b6b7d8')
      .attr('stroke','#888')
      .attr('cursor','pointer')
      .on('mouseover',function(e){
        d3.select(this).attr('fill','#1e3a8a');
        // Tooltip for bar
        let tooltip = d3.select('#ticketTypeBarTooltip');
        if (tooltip.empty()) {
          tooltip = d3.select('body').append('div')
            .attr('id', 'ticketTypeBarTooltip')
            .attr('class', 'radial-tooltip')
            .style('position', 'absolute')
            .style('pointer-events', 'none')
            .style('background', 'rgba(255,255,255,0.98)')
            .style('border', '1px solid #e5e7eb')
            .style('border-radius', '4px')
            .style('padding', '10px 16px')
            .style('font-family', 'PT Serif, serif')
            .style('font-size', '1rem')
            .style('color', '#222')
            .style('z-index', 1000);
        }
        const value = typeCounts[i].toLocaleString();
        const pct = data.length > 0 ? `${Math.round(typeCounts[i]/data.length*100)}%` : '0%';
        tooltip.html(`<b>${type}</b> Ticket<br>Count: <b>${value}</b><br>Percent: <b>${pct}</b>`)
          .style('left', (e.pageX + 14) + 'px')
          .style('top', (e.pageY - 18) + 'px')
          .style('opacity', 1);
      })
      .on('mousemove',function(e){
        d3.select('#ticketTypeBarTooltip')
          .style('left', (e.pageX + 14) + 'px')
          .style('top', (e.pageY - 18) + 'px');
      })
      .on('mouseout',function(){
        d3.select(this).attr('fill','#b6b7d8');
        d3.select('#ticketTypeBarTooltip').style('opacity', 0);
      })
      .on('click',function(){
        if(window.ticketTypeFilters && window.ticketTypeFilters.ticketType===type){window.ticketTypeFilters.ticketType=null;}else{window.ticketTypeFilters.ticketType=type;}
        updateTicketTypeDist();
      });
    // Bar value + percent (above bar)
    svg.append('text')
      .attr('x',x+barW/2)
      .attr('y',barBaseY-h-12)
      .attr('text-anchor','middle')
      .attr('font-size','16px')
      .attr('font-family','Georgia,Times New Roman,serif')
      .attr('font-weight','bold')
      .attr('fill','#222')
      .text(`${typeCounts[i].toLocaleString()} ${Math.round(typeCounts[i]/data.length*100)}%`);
    // Bar label
    svg.append('text')
      .attr('x',x+barW/2)
      .attr('y',barBaseY+24)
      .attr('text-anchor','middle')
      .attr('font-size','16px')
      .attr('font-family','Georgia,Times New Roman,serif')
      .attr('fill','#222')
      .text(type);
  });
  // 下方 dashboard-sub 文字描述暂不写
  // 计算Standard class占比
  const standardCount = classCounts[0].v;
  const standardPct = total > 0 ? Math.round(standardCount/total*100) : 0;
  // 只在Standard class中统计票型
  const standardData = classData.filter(d=>d['Ticket Class']==='Standard');
  const standardTotal = standardData.length;
  let mostType = 'Advance', mostTypePct = 0;
  if (standardTotal > 0) {
    const typeCountInStandard = typeKeys.map(type=>standardData.filter(d=>d['Ticket Type']===type).length);
    const maxIdx = typeCountInStandard.indexOf(Math.max(...typeCountInStandard));
    mostType = typeKeys[maxIdx];
    mostTypePct = Math.round(typeCountInStandard[maxIdx]/standardTotal*100);
  }
  const desc = `The most common ticket class is <b>Standard class</b> (<b>${standardPct}%</b>) and within this class, <b>${mostType}</b> tickets (<b>${mostTypePct}%</b>) are the most common.`;
  d3.select('#tickettype-desc').html(desc);
}

// 票种分布 filter 联动
window.ticketTypeFilters = { class: null, ticketType: null, time: 'ALL' };
let ticketTypeRawData = [];
function updateTicketTypeDist() {
  let data = ticketTypeRawData;
  // 联动时间 filter
  if(window.ticketTypeFilters.time && window.ticketTypeFilters.time !== 'ALL'){
    data = data.filter(d => {
      const hour = parseInt((d['Departure Time']||'').split(':')[0]);
      switch(window.ticketTypeFilters.time) {
        case 'AM': return hour >= 0 && hour < 12;
        case 'PM': return hour >= 12 && hour < 24;
        case 'Peak': return (hour >= 6 && hour < 9) || (hour >= 16 && hour < 19);
        case 'Off-Peak': return (hour < 6 || hour >= 9) && (hour < 16 || hour >= 19);
        default: return true;
      }
    });
  }
  if(window.ticketTypeFilters.class){
    data = data.filter(d=>d['Ticket Class']===window.ticketTypeFilters.class);
  }
  if(window.ticketTypeFilters.ticketType){
    data = data.filter(d=>d['Ticket Type']===window.ticketTypeFilters.ticketType);
  }
  drawTicketTypeDist(data);
}
function initTicketTypeDist() {
  d3.csv('data/railway.csv').then(data => {
    ticketTypeRawData = data;
    updateTicketTypeDist();
  });
}
// 页面加载时初始化
if(typeof document!=='undefined'){
  document.addEventListener('DOMContentLoaded',()=>{
    initTicketTypeDist();
    // 联动时间 filter 按钮
    d3.selectAll('#timeFilterGroup .time-filter-btn').on('click.tickettype', function() {
      window.ticketTypeFilters.time = d3.select(this).text();
      updateTicketTypeDist();
    });
  });
}

// --- Busiest Time Slots Chart ---
function drawBusiestSlots(data) {
  const svgId = '#chart-busiest-slots';
  d3.select(svgId).selectAll('*').remove();
  // 根据 window.ticketTypeFilters.time 动态设置 slotLabels
  let slotLabels;
  const filters = window.ticketTypeFilters || { time: 'ALL' };
  if (filters.time === 'PM') {
    slotLabels = [
      '16:00','16:15','16:30','16:45','17:00','17:15','17:30','17:45','18:00','18:15','18:30','18:45'
    ];
  } else {
    slotLabels = [
      '06:00','06:15','06:30','06:45','07:00','07:15','07:30','07:45','08:00','08:15','08:30','08:45'
    ];
  }
  const slotMinutes = slotLabels.map(t => {
    const [h,m] = t.split(':');
    return parseInt(h)*60+parseInt(m);
  });
  const slotCounts = slotLabels.map((label,i) => {
    const min = slotMinutes[i], max = slotMinutes[i]+15;
    const count = data.filter(row => {
      const t = row['Departure Time'];
      if (!t) return false;
      const [h,m] = t.split(':');
      const mins = parseInt(h)*60+parseInt(m);
      return mins >= min && mins < max;
    }).length;
    return count;
  });
  const total = d3.sum(slotCounts);
  const slotPercents = slotCounts.map(c => total>0 ? Math.round(c/total*100) : 0);
  // 选中索引
  let selectedIdx = -1;
  if (typeof filters.busiestSlot === 'string') {
    selectedIdx = slotLabels.indexOf(filters.busiestSlot);
  }
  const width = 700, height = 260, margin = {top: 60, right: 30, bottom: 50, left: 40};
  const svg = d3.select(svgId).append('svg')
    .attr('width','100%')
    .attr('height',height)
    .attr('viewBox',`0 0 ${width} ${height}`)
    .attr('preserveAspectRatio','xMinYMin meet');
  // 为阶梯线和面积图补最后一个点
  const slotLabelsExt = slotLabels.concat([filters.time==='PM'?"19:00":"09:00"]);
  const slotPercentsExt = slotPercents.concat([slotPercents[slotPercents.length-1]]);
  // 横坐标整体右移 offset
  const xOffset = 5;
  const x = d3.scalePoint().domain(slotLabelsExt).range([margin.left + xOffset, width - margin.right + xOffset]);
  const y = d3.scaleLinear().domain([0, d3.max(slotPercentsExt)*1.2]).range([height-margin.bottom, margin.top]);
  // 阶梯线下方补充 area 颜色（不封口）
  const area = d3.area()
    .x((d,i)=>x(slotLabelsExt[i]))
    .y0((d,i)=>y(0))
    .y1((d,i)=>y(slotPercentsExt[i]))
    .curve(d3.curveStepAfter);
  svg.append('path')
    .datum(slotPercentsExt)
    .attr('fill','#b6b7d8')
    .attr('stroke','none')
    .attr('d',area);
  // 阶梯线
  const line = d3.line()
    .x((d,i)=>x(slotLabelsExt[i]))
    .y((d,i)=>y(slotPercentsExt[i]))
    .curve(d3.curveStepAfter);
  svg.append('path')
    .datum(slotPercentsExt)
    .attr('fill','none')
    .attr('stroke','#1e3a8a')
    .attr('stroke-width',3)
    .attr('d',line);
  // 百分比数字，右移，数据绑定用 idx，hover 精确
  svg.selectAll('.slot-label')
    .data(slotPercents.map((d,i)=>({value:d,idx:i})))
    .enter().append('text')
    .attr('x',d=>x(slotLabelsExt[d.idx])+25)
    .attr('y',d=>y(d.value)-15)
    .attr('text-anchor','middle')
    .attr('font-size','16px')
    .attr('fill',d=>selectedIdx===d.idx?'#1e3a8a':'#888')
    .text(d=>d.value>0?`${d.value}%`:'' )
    .style('cursor','pointer')
    .on('mouseover',function(e,d){
      showDot(d.idx);
      // Tooltip for slot
      let tooltip = d3.select('#busiestSlotTooltip');
      if (tooltip.empty()) {
        tooltip = d3.select('body').append('div')
          .attr('id', 'busiestSlotTooltip')
          .attr('class', 'radial-tooltip')
          .style('position', 'absolute')
          .style('pointer-events', 'none')
          .style('background', 'rgba(255,255,255,0.98)')
          .style('border', '1px solid #e5e7eb')
          .style('border-radius', '4px')
          .style('padding', '10px 16px')
          .style('font-family', 'PT Serif, serif')
          .style('font-size', '1rem')
          .style('color', '#222')
          .style('z-index', 1000);
      }
      const label = slotLabels[d.idx];
      const percent = slotPercents[d.idx];
      const count = slotCounts[d.idx];
      tooltip.html(`<b>${label}</b><br>Departures: <b>${count.toLocaleString()}</b><br>Percent: <b>${percent}%</b>`)
        .style('left', (e.pageX + 14) + 'px')
        .style('top', (e.pageY - 18) + 'px')
        .style('opacity', 1);
    })
    .on('mousemove',function(e,d){
      d3.select('#busiestSlotTooltip')
        .style('left', (e.pageX + 14) + 'px')
        .style('top', (e.pageY - 18) + 'px');
    })
    .on('mouseout',function(e,d){
      hideDot();
      d3.select('#busiestSlotTooltip').style('opacity', 0);
    })
    .on('click',function(e,d){
      if(window.ticketTypeFilters.busiestSlot===slotLabels[d.idx]){window.ticketTypeFilters.busiestSlot=null;}else{window.ticketTypeFilters.busiestSlot=slotLabels[d.idx];}
      updateBusiestSlots();
    });
  // 默认不显示节点，hover时显示，节点更小且右移
  let dot = svg.append('circle')
    .attr('class','slot-dot-temp')
    .attr('r',5)
    .attr('fill','#1e3a8a')
    .attr('stroke','#1e3a8a')
    .attr('stroke-width',2.5)
    .style('display','none')
    .style('pointer-events','none');
  function showDot(idx){
    dot.attr('cx',x(slotLabelsExt[idx])+20)
      .attr('cy',y(slotPercentsExt[idx]))
      .style('display','block');
  }
  function hideDot(){
    dot.style('display','none');
  }
  // 横坐标
  svg.append('g')
    .attr('transform',`translate(0,${height-margin.bottom})`)
    .call(d3.axisBottom(x)
      .tickSize(0)
      .tickFormat(d => d === (filters.time==='PM'?'19:00':'09:00') ? '' : d)
    )
    .selectAll('text')
    .attr('font-size',16)
    .attr('font-family','Georgia,Times New Roman,serif')
    .attr('fill', '#444')
    .attr('dx',20); // 横坐标文字整体右移
  // 注释文字往上提
  d3.select('#busiest-desc').style('margin-top','-40px');
  const selCount = slotCounts[selectedIdx>=0?selectedIdx:slotCounts.indexOf(d3.max(slotCounts))];
  const selLabel = slotLabels[selectedIdx>=0?selectedIdx:slotCounts.indexOf(d3.max(slotCounts))];
  // 动态设置描述文本
  let peakLabel = slotLabels[0].startsWith('16') ? 'evening' : 'morning';
  d3.select('#busiest-desc').html(`The busiest departure time during the <b>${peakLabel} peak hours</b> is at <b>${selLabel}</b> with <b>${selCount?selCount.toLocaleString():'0'}</b> departures.`);
}

// 联动更新
function updateBusiestSlots() {
  let data = ticketTypeRawData;
  // 联动时间 filter
  if(window.ticketTypeFilters.time && window.ticketTypeFilters.time !== 'ALL'){
    data = data.filter(d => {
      const hour = parseInt((d['Departure Time']||'').split(':')[0]);
      switch(window.ticketTypeFilters.time) {
        case 'AM': return hour >= 0 && hour < 12;
        case 'PM': return hour >= 12 && hour < 24;
        case 'Peak': return (hour >= 6 && hour < 9) || (hour >= 16 && hour < 19);
        case 'Off-Peak': return (hour < 6 || hour >= 9) && (hour < 16 || hour >= 19);
        default: return true;
      }
    });
  }
  if(window.ticketTypeFilters.class){
    data = data.filter(d=>d['Ticket Class']===window.ticketTypeFilters.class);
  }
  if(window.ticketTypeFilters.ticketType){
    data = data.filter(d=>d['Ticket Type']===window.ticketTypeFilters.ticketType);
  }
  drawBusiestSlots(data);
}
// 页面加载和 filter 联动
if(typeof document!=='undefined'){
  document.addEventListener('DOMContentLoaded',()=>{
    // 初始渲染
    updateBusiestSlots();
    // 联动 filter 按钮
    d3.selectAll('#timeFilterGroup .time-filter-btn').on('click.busiest', function() {
      window.ticketTypeFilters.time = d3.select(this).text();
      updateBusiestSlots();
    });
  });
}

// --- Peak Hours Chart ---
function drawPeakHours(data) {
  const svgId = '#chart-peak-hours';
  d3.select(svgId).selectAll('*').remove();
  // 1. 统计每小时（0-11 for AM, 12-23 for PM）总量
  let hourRange, hourLabels;
  const filters = window.ticketTypeFilters || { time: 'ALL' };
  if (filters.time === 'PM') {
    hourRange = d3.range(12, 24); // 12-23
    hourLabels = hourRange.map(h => h === 12 ? '12 PM' : (h > 12 ? (h-12)+' PM' : h+' PM'));
  } else {
    hourRange = d3.range(0, 12); // 0-11
    hourLabels = hourRange.map(h => h === 0 ? '12 AM' : (h < 12 ? h+' AM' : h+' AM'));
  }
  // 统计每小时总量
  function getHour(t) {
    if (!t) return null;
    const [h, m] = t.split(':');
    return parseInt(h, 10);
  }
  const hourCounts = hourRange.map(h => data.filter(row => getHour(row['Departure Time']) === h).length);
  // 2. 统计每小时×周几热力图数据
  const weekDays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const getWeekDay = dateStr => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return weekDays[(d.getDay()+6)%7]; // 0=Sun, 1=Mon,...
  };
  const heatData = weekDays.map(day => hourRange.map(h => data.filter(row => getHour(row['Departure Time']) === h && getWeekDay(row['Date of Journey']) === day).length));
  // 3. 布局参数
  const width = 900, barHeight = 180, heatHeight = 220, margin = {top: 60, right: 30, bottom: 60, left: 160};
  const svg = d3.select(svgId).append('svg')
    .attr('width', '100%')
    .attr('height', barHeight + heatHeight)
    .attr('viewBox', `0 0 ${width} ${barHeight + heatHeight}`)
    .attr('preserveAspectRatio', 'xMinYMin meet');
  const x = d3.scaleBand().domain(hourLabels).range([margin.left, width - margin.right]).padding(0.18);
  const y = d3.scaleLinear().domain([0, d3.max(hourCounts)*1.35]).range([barHeight - margin.bottom, margin.top]);
  // 4. 柱状图
  let selectedHourIdx = -1;
  if (typeof filters.busiestSlot === 'string') {
    selectedHourIdx = hourLabels.findIndex(label => {
      let hour = label.split(' ')[0];
      if (label.includes('PM') && hour !== '12') hour = (parseInt(hour,10)+12).toString();
      if (label.includes('AM') && hour === '12') hour = '0';
      if (filters.busiestSlot) {
        const [h,m] = filters.busiestSlot.split(':');
        return parseInt(h,10).toString() === hour;
      }
      return false;
    });
  }
  svg.selectAll('.bar')
    .data(hourCounts)
    .enter().append('rect')
    .attr('class', 'bar')
    .attr('x', (d,i) => x(hourLabels[i]))
    .attr('y', d => y(d))
    .attr('width', x.bandwidth())
    .attr('height', d => y(0) - y(d))
    .attr('fill', (d,i) => i === selectedHourIdx ? '#ffe69c' : '#b6b7d8')
    .attr('stroke', '#888')
    .attr('rx', 7)
    .attr('ry', 7)
    .attr('opacity', 0.95)
    .style('cursor','pointer')
    .on('mouseover', function(e, d) {
      d3.select(this).attr('fill', '#1e3a8a');
      // Tooltip for bar
      let tooltip = d3.select('#peakHoursBarTooltip');
      if (tooltip.empty()) {
        tooltip = d3.select('body').append('div')
          .attr('id', 'peakHoursBarTooltip')
          .attr('class', 'radial-tooltip')
          .style('position', 'absolute')
          .style('pointer-events', 'none')
          .style('background', 'rgba(255,255,255,0.98)')
          .style('border', '1px solid #e5e7eb')
          .style('border-radius', '4px')
          .style('padding', '10px 16px')
          .style('font-family', 'PT Serif, serif')
          .style('font-size', '1rem')
          .style('color', '#222')
          .style('z-index', 1000);
      }
      const idx = this.__data__idx;
      tooltip.html(`<b>${hourLabels[idx]}</b><br>Departures: <b>${hourCounts[idx].toLocaleString()}</b>`)
        .style('left', (e.pageX + 14) + 'px')
        .style('top', (e.pageY - 18) + 'px')
        .style('opacity', 1);
    })
    .on('mousemove', function(e, d) {
      d3.select('#peakHoursBarTooltip')
        .style('left', (e.pageX + 14) + 'px')
        .style('top', (e.pageY - 18) + 'px');
    })
    .on('mouseout', function(e, d, i) {
      if(selectedHourIdx !== this.__data__idx) d3.select(this).attr('fill', '#b6b7d8');
      d3.select('#peakHoursBarTooltip').style('opacity', 0);
    })
    .on('click', function(e, d) {
      const idx = this.__data__idx;
      let hour = hourLabels[idx].split(' ')[0];
      if (hourLabels[idx].includes('PM') && hour !== '12') hour = (parseInt(hour,10)+12).toString();
      if (hourLabels[idx].includes('AM') && hour === '12') hour = '0';
      const slotStr = (hour.padStart(2,'0')) + ':00';
      if(filters.busiestSlot === slotStr){
        filters.busiestSlot = null;
      }else{
        filters.busiestSlot = slotStr;
      }
      updatePeakHours();
    })
    .each(function(d,i){ this.__data__idx = i; });
  // 5. 顶部数字标签
  svg.selectAll('.bar-label')
    .data(hourCounts)
    .enter().append('text')
    .attr('class', 'bar-label')
    .attr('x', (d,i) => x(hourLabels[i]) + x.bandwidth()/2 + 450)
    .attr('y', d => y(d) - 8)
    .attr('text-anchor', 'middle')
    .attr('font-size', 16)
    .attr('font-family', 'Georgia,Times New Roman,serif')
    .attr('font-weight', 'bold')
    .attr('fill', '#222')
    .text(d => d > 0 ? d.toLocaleString() : '');
  // 6. X轴小时标签
  svg.append('g')
    .attr('transform', `translate(0,${barHeight - margin.bottom})`)
    .call(d3.axisBottom(x).tickSize(0))
    .selectAll('text')
    .attr('font-size', 16)
    .attr('font-family', 'Georgia,Times New Roman,serif')
    .attr('fill', '#222');
  // 7. 热力图
  const heatCellW = x.bandwidth(), heatCellH = 28, heatY0 = barHeight - 20;
  const heatMax = d3.max(heatData.flat());
  const colorScale = d3.scaleLinear().domain([0, heatMax]).range(['#f3f1eb', '#1e3a8a']);
  svg.selectAll('.heat-row')
    .data(heatData)
    .enter().append('g')
    .attr('class','heat-row')
    .attr('transform',(d,i)=>`translate(0,${heatY0 + i*heatCellH})`)
    .each(function(row, rowIdx){
      d3.select(this).selectAll('.heat-cell')
        .data(row)
        .enter().append('rect')
        .attr('class','heat-cell')
        .attr('x',(d,i)=>x(hourLabels[i]))
        .attr('y',0)
        .attr('width',heatCellW)
        .attr('height',heatCellH-2)
        .attr('rx',5)
        .attr('ry',5)
        .attr('fill',(d,i)=>selectedHourIdx===i?'#ffe69c':colorScale(d))
        .attr('stroke',(d,i)=>selectedHourIdx===i?'#222':'none')
        .attr('stroke-width',1.5)
        .style('cursor','pointer')
        .on('mouseover',function(e,d){
          d3.select(this).attr('fill','#ffe69c').attr('stroke','#222');
          // Tooltip for heat cell
          let tooltip = d3.select('#peakHoursHeatTooltip');
          if (tooltip.empty()) {
            tooltip = d3.select('body').append('div')
              .attr('id', 'peakHoursHeatTooltip')
              .attr('class', 'radial-tooltip')
              .style('position', 'absolute')
              .style('pointer-events', 'none')
              .style('background', 'rgba(255,255,255,0.98)')
              .style('border', '1px solid #e5e7eb')
              .style('border-radius', '4px')
              .style('padding', '10px 16px')
              .style('font-family', 'PT Serif, serif')
              .style('font-size', '1rem')
              .style('color', '#222')
              .style('z-index', 1000);
          }
          const hour = hourLabels[d3.select(this).data()[0].__data__idx];
          const day = weekDays[rowIdx];
          tooltip.html(`<b>${day} ${hour}</b><br>Departures: <b>${d.toLocaleString()}</b>`)
            .style('left', (e.pageX + 14) + 'px')
            .style('top', (e.pageY - 18) + 'px')
            .style('opacity', 1);
        })
        .on('mousemove',function(e,d){
          d3.select('#peakHoursHeatTooltip')
            .style('left', (e.pageX + 14) + 'px')
            .style('top', (e.pageY - 18) + 'px');
        })
        .on('mouseout',function(e,d,i){
          d3.select(this).attr('fill',selectedHourIdx===i?'#ffe69c':colorScale(d)).attr('stroke',selectedHourIdx===i?'#222':'none');
          d3.select('#peakHoursHeatTooltip').style('opacity', 0);
        })
        .on('click',function(e,d,i){
          if(filters.busiestSlot === i){
            filters.busiestSlot = null;
          }else{
            filters.busiestSlot = i;
          }
          updatePeakHours();
        });
      // 热力图数字
      d3.select(this).selectAll('.heat-label')
        .data(row)
        .enter().append('text')
        .attr('class','heat-label')
        .attr('x',(d,i)=>x(hourLabels[i])+heatCellW/2)
        .attr('y',heatCellH/2+2)
        .attr('text-anchor','middle')
        .attr('font-size',15)
        .attr('font-family','Georgia,Times New Roman,serif')
        .attr('fill','#222')
        .attr('font-weight','bold')
        .text(d=>d>0?d:'');
    });
  // 8. 热力图左侧周几标签
  svg.selectAll('.heat-day-label')
    .data(weekDays)
    .enter().append('text')
    .attr('class','heat-day-label')
    .attr('x',margin.left-12)
    .attr('y',(d,i)=>heatY0 + i*heatCellH + heatCellH/2 + 4)
    .attr('text-anchor','end')
    .attr('font-size',16)
    .attr('font-family','Georgia,Times New Roman,serif')
    .attr('fill','#222')
    .attr('font-weight','bold')
    .text(d=>d);
  // 9. 描述区
  d3.select('#peak-hours-desc').html('The AM peak hours are from <b>6 AM to 9 AM</b> and the PM peak hours are from <b>4 PM to 7 PM</b>. These are the busiest hours, indicating the highest demand for rail services.');
}

// 联动更新
function updatePeakHours() {
  let data = ticketTypeRawData;
  // 联动时间 filter
  if(window.ticketTypeFilters.time && window.ticketTypeFilters.time !== 'ALL'){
    data = data.filter(d => {
      const hour = parseInt((d['Departure Time']||'').split(':')[0]);
      switch(window.ticketTypeFilters.time) {
        case 'AM': return hour >= 0 && hour < 12;
        case 'PM': return hour >= 12 && hour < 24;
        case 'Peak': return (hour >= 6 && hour < 9) || (hour >= 16 && hour < 19);
        case 'Off-Peak': return (hour < 6 || hour >= 9) && (hour < 16 || hour >= 19);
        default: return true;
      }
    });
  }
  if(window.ticketTypeFilters.class){
    data = data.filter(d=>d['Ticket Class']===window.ticketTypeFilters.class);
  }
  if(window.ticketTypeFilters.ticketType){
    data = data.filter(d=>d['Ticket Type']===window.ticketTypeFilters.ticketType);
  }
  drawPeakHours(data);
}
// 页面加载和 filter 联动
if(typeof document!=='undefined'){
  document.addEventListener('DOMContentLoaded',()=>{
    updatePeakHours();
    d3.selectAll('#timeFilterGroup .time-filter-btn').on('click.peakhours', function() {
      window.ticketTypeFilters.time = d3.select(this).text();
      updatePeakHours();
    });
  });
}

// --- Top 7 Departure Stations Chart ---
function drawTopDeparture(data) {
  const svgId = '#chart-top-departure';
  d3.select(svgId).selectAll('*').remove();
  // 1. 统计每个站点的最大出发量及其对应时间
  const stationMap = {};
  data.forEach(row => {
    const station = row['Departure Station'];
    const time = row['Departure Time'];
    if (!station || !time) return;
    if (!stationMap[station]) stationMap[station] = {};
    stationMap[station][time] = (stationMap[station][time] || 0) + 1;
  });
  // 2. 计算每站最大出发量及其时间
  const stationStats = Object.entries(stationMap).map(([station, timeMap]) => {
    let maxCount = 0, maxTime = '';
    Object.entries(timeMap).forEach(([t, c]) => {
      if (c > maxCount) { maxCount = c; maxTime = t; }
    });
    return { station, maxCount, maxTime };
  });
  // 3. 取前7名，按出发量降序
  const top7 = stationStats.sort((a,b)=>b.maxCount-a.maxCount).slice(0,7);
  const maxBar = top7.length ? top7[0].maxCount : 1;
  // 4. 渲染美化bar列表
  const container = d3.select(svgId)
    .append('div')
    .attr('class','top-departure-list')
    .style('display','flex')
    .style('flex-direction','column')
    .style('gap','12px')
    .style('margin-top','10px');
  const filters = window.ticketTypeFilters || {};
  const selectedStation = filters.station;
  top7.forEach((d, i) => {
    const row = container.append('div')
      .attr('class','top-departure-row')
      .style('display','flex')
      .style('align-items','right')
      .style('gap','1px');
    row.append('div')
      .attr('class','station-name')
      .style('width','120px')
      .style('font-size','0.88rem')
      .style('color','#444')
      .style('font-family','Georgia,Times New Roman,serif')
      .text(d.station);
    // bar+label
    const barW = 220, barH = 28;
    const barLen = Math.max(40, d.maxCount/maxBar*barW);
    const isSelected = selectedStation === d.station;
    const barWrap = row.append('div')
      .attr('class','station-bar')
      .style('position','relative')
      .style('height',barH+'px')
      .style('width',barW+'px')
      .style('background','#f8f6f1')
      .style('border-radius','7px')
      .style('display','flex')
      .style('align-items','center')
      .style('overflow','visible')
      .style('cursor','pointer')
      .on('click', function() {
        if(filters.station === d.station){
          filters.station = null;
        }else{
          filters.station = d.station;
        }
        updateTopDeparture();
      });
    barWrap.append('div')
      .attr('class','station-bar-fill')
      .style('position','absolute')
      .style('left','0')
      .style('top','0')
      .style('height',barH+'px')
      .style('width',barLen+'px')
      .style('background',isSelected ? '#1e3a8a' : '#b6b7d8')
      .style('border-radius','7px')
      .style('z-index','1');
    // label内容
    barWrap.append('div')
      .attr('class','station-bar-label')
      .style('position','relative')
      .style('z-index','2')
      .style('font-weight','bold')
      .style('font-size','1.08rem')
      .style('color','#222')
      .style('font-family','Georgia,Times New Roman,serif')
      .style('margin-left','12px')
      .style('display','inline-block')
      .style('background','#f8f6f1')
      .style('border-radius','6px')
      .style('padding','2px 8px 2px 8px')
      .text(`${d.maxCount.toLocaleString()} | ${formatTime(d.maxTime)}`);
  });
  // 时间格式化 24h->12h
  function formatTime(t) {
    if (!t) return '';
    const [h,m] = t.split(':').map(Number);
    const ampm = h<12 ? 'AM' : 'PM';
    const h12 = h%12===0?12:h%12;
    return `${h12}:${(m+'').padStart(2,'0')} ${ampm}`;
  }
}

// 联动更新
function updateTopDeparture() {
  let data = ticketTypeRawData;
  // 联动 filter
  if(window.ticketTypeFilters.time && window.ticketTypeFilters.time !== 'ALL'){
    data = data.filter(d => {
      const hour = parseInt((d['Departure Time']||'').split(':')[0]);
      switch(window.ticketTypeFilters.time) {
        case 'AM': return hour >= 0 && hour < 12;
        case 'PM': return hour >= 12 && hour < 24;
        case 'Peak': return (hour >= 6 && hour < 9) || (hour >= 16 && hour < 19);
        case 'Off-Peak': return (hour < 6 || hour >= 9) && (hour < 16 || hour >= 19);
        default: return true;
      }
    });
  }
  if(window.ticketTypeFilters.class){
    data = data.filter(d=>d['Ticket Class']===window.ticketTypeFilters.class);
  }
  if(window.ticketTypeFilters.ticketType){
    data = data.filter(d=>d['Ticket Type']===window.ticketTypeFilters.ticketType);
  }
  drawTopDeparture(data);
}
// 页面加载和 filter 联动
if(typeof document!=='undefined'){
  document.addEventListener('DOMContentLoaded',()=>{
    updateTopDeparture();
    d3.selectAll('#timeFilterGroup .time-filter-btn').on('click.topdeparture', function() {
      window.ticketTypeFilters.time = d3.select(this).text();
      updateTopDeparture();
    });
  });
}

// --- Top 7 Arrival Stations Chart ---
function drawTopArrival(data) {
  const svgId = '#chart-top-arrival';
  d3.select(svgId).selectAll('*').remove();
  // 1. 统计每个到达站点的最大到达量及其对应时间
  const stationMap = {};
  data.forEach(row => {
    const station = row['Arrival Destination'];
    const time = row['Arrival Time'];
    if (!station || !time) return;
    if (!stationMap[station]) stationMap[station] = {};
    stationMap[station][time] = (stationMap[station][time] || 0) + 1;
  });
  // 2. 计算每站最大到达量及其时间
  const stationStats = Object.entries(stationMap).map(([station, timeMap]) => {
    let maxCount = 0, maxTime = '';
    Object.entries(timeMap).forEach(([t, c]) => {
      if (c > maxCount) { maxCount = c; maxTime = t; }
    });
    return { station, maxCount, maxTime };
  });
  // 3. 取前7名，按到达量降序
  const top7 = stationStats.sort((a,b)=>b.maxCount-a.maxCount).slice(0,7);
  const maxBar = top7.length ? top7[0].maxCount : 1;
  // 4. 渲染bar列表，交互与配色同Departure
  const container = d3.select(svgId)
    .append('div')
    .attr('class','top-arrival-list')
    .style('display','flex')
    .style('flex-direction','column')
    .style('gap','12px')
    .style('margin-top','10px');
  const filters = window.ticketTypeFilters || {};
  const selectedStation = filters.station;
  top7.forEach((d, i) => {
    const row = container.append('div')
      .attr('class','top-arrival-row')
      .style('display','flex')
      .style('align-items','right')
      .style('gap','1px');
    row.append('div')
      .attr('class','station-name')
      .style('width','120px')
      .style('font-size','0.88rem')
      .style('color','#444')
      .style('font-family','Georgia,Times New Roman,serif')
      .text(d.station);
    // bar+label
    const barW = 220, barH = 28;
    const barLen = Math.max(40, d.maxCount/maxBar*barW);
    const isSelected = selectedStation === d.station;
    const barWrap = row.append('div')
      .attr('class','station-bar')
      .style('position','relative')
      .style('height',barH+'px')
      .style('width',barW+'px')
      .style('background','#f8f6f1')
      .style('border-radius','7px')
      .style('display','flex')
      .style('align-items','center')
      .style('overflow','visible')
      .style('cursor','pointer')
      .on('click', function() {
        if(filters.station === d.station){
          filters.station = null;
        }else{
          filters.station = d.station;
        }
        updateTopArrival();
      });
    barWrap.append('div')
      .attr('class','station-bar-fill')
      .style('position','absolute')
      .style('left','0')
      .style('top','0')
      .style('height',barH+'px')
      .style('width',barLen+'px')
      .style('background',isSelected ? '#1e3a8a' : '#b6b7d8')
      .style('border-radius','7px')
      .style('z-index','1');
    // label内容
    barWrap.append('div')
      .attr('class','station-bar-label')
      .style('position','relative')
      .style('z-index','2')
      .style('font-weight','bold')
      .style('font-size','1.08rem')
      .style('color','#222')
      .style('font-family','Georgia,Times New Roman,serif')
      .style('margin-left','12px')
      .style('display','inline-block')
      .style('background','#f8f6f1')
      .style('border-radius','6px')
      .style('padding','2px 8px 2px 8px')
      .text(`${d.maxCount.toLocaleString()} | ${formatTime(d.maxTime)}`);
  });
  // 时间格式化 24h->12h
  function formatTime(t) {
    if (!t) return '';
    const [h,m] = t.split(':').map(Number);
    const ampm = h<12 ? 'AM' : 'PM';
    const h12 = h%12===0?12:h%12;
    return `${h12}:${(m+'').padStart(2,'0')} ${ampm}`;
  }
}

// 联动更新
function updateTopArrival() {
  let data = ticketTypeRawData;
  // 联动 filter
  if(window.ticketTypeFilters.time && window.ticketTypeFilters.time !== 'ALL'){
    data = data.filter(d => {
      const hour = parseInt((d['Arrival Time']||'').split(':')[0]);
      switch(window.ticketTypeFilters.time) {
        case 'AM': return hour >= 0 && hour < 12;
        case 'PM': return hour >= 12 && hour < 24;
        case 'Peak': return (hour >= 6 && hour < 9) || (hour >= 16 && hour < 19);
        case 'Off-Peak': return (hour < 6 || hour >= 9) && (hour < 16 || hour >= 19);
        default: return true;
      }
    });
  }
  if(window.ticketTypeFilters.class){
    data = data.filter(d=>d['Ticket Class']===window.ticketTypeFilters.class);
  }
  if(window.ticketTypeFilters.ticketType){
    data = data.filter(d=>d['Ticket Type']===window.ticketTypeFilters.ticketType);
  }
  drawTopArrival(data);
}
// 页面加载和 filter 联动
if(typeof document!=='undefined'){
  document.addEventListener('DOMContentLoaded',()=>{
    updateTopArrival();
    d3.selectAll('#timeFilterGroup .time-filter-btn').on('click.toparrival', function() {
      window.ticketTypeFilters.time = d3.select(this).text();
      updateTopArrival();
    });
  });
}

// ... existing code ...
if(typeof document!=='undefined'){
  document.addEventListener('DOMContentLoaded',()=>{
    // ... existing code ...
    // 保证初始状态和点击 ALL 一致
    setTimeout(() => {
      const allBtn = document.querySelector('#timeFilterGroup .time-filter-btn');
      if (allBtn) allBtn.click();
    }, 0);
  });
}

// ... existing code ...
if(typeof document!=='undefined'){
  document.addEventListener('DOMContentLoaded',()=>{
    // ... existing code ...
    // 页面加载时主动刷新所有图表，确保初始状态和点击ALL一致
    if (typeof updateJourneyTrend === 'function') updateJourneyTrend();
    if (typeof updateRailcardDist === 'function') updateRailcardDist();
    if (typeof updateTicketTypeDist === 'function') updateTicketTypeDist();
    if (typeof updateBusiestSlots === 'function') updateBusiestSlots();
    if (typeof updatePeakHours === 'function') updatePeakHours();
    if (typeof updateTopDeparture === 'function') updateTopDeparture();
    if (typeof updateTopArrival === 'function') updateTopArrival();
  });
}
// ... existing code ...

// 统一的数据加载和初始化函数
async function initializeAllCharts() {
    try {
        // 加载所有数据
        const [journeyDataResult] = await Promise.all([
            d3.csv('data/railway.csv'),
            // 其他数据加载...
        ]);

        // 设置全局数据
        journeyData = journeyDataResult;
        ticketTypeRawData = journeyDataResult;

        // 初始化所有图表
        initJourneyTrend();
        initRailcardDist();
        initTicketTypeDist();
        initBusiestSlots();
        initPeakHours();
        initTopDeparture();
        initTopArrival();

        // 统一绑定filter事件
        setupGlobalFilters();

        // 数据加载完成后，触发一次"ALL"按钮点击
        const allBtn = document.querySelector('#timeFilterGroup .time-filter-btn');
        if (allBtn) {
            allBtn.click();
        }
    } catch (error) {
        console.error('Error initializing charts:', error);
    }
}

// 统一的filter事件绑定
function setupGlobalFilters() {
    // 移除所有已存在的事件绑定
    d3.selectAll('#timeFilterGroup .time-filter-btn').on('click', null);
    
    // 重新绑定统一的事件处理
    d3.selectAll('#timeFilterGroup .time-filter-btn').on('click', function() {
        // 更新按钮状态
        d3.selectAll('#timeFilterGroup .time-filter-btn').classed('active', false);
        d3.select(this).classed('active', true);
        
        // 更新filter值
        const time = d3.select(this).text();
        journeyFilters.time = time;
        window.ticketTypeFilters.time = time;
        
        // 统一更新所有图表
        updateAllCharts();
    });
}

// 统一的图表更新函数
function updateAllCharts() {
    if (typeof updateJourneyTrend === 'function') updateJourneyTrend();
    if (typeof updateRailcardDist === 'function') updateRailcardDist();
    if (typeof updateTicketTypeDist === 'function') updateTicketTypeDist();
    if (typeof updateBusiestSlots === 'function') updateBusiestSlots();
    if (typeof updatePeakHours === 'function') updatePeakHours();
    if (typeof updateTopDeparture === 'function') updateTopDeparture();
    if (typeof updateTopArrival === 'function') updateTopArrival();
}

// 修改各个init函数，移除filter事件绑定
function initJourneyTrend() {
    setupJourneyTrendFilter();
}

function initRailcardDist() {
    // 只初始化，不绑定事件
}

function initTicketTypeDist() {
    // 只初始化，不绑定事件
}

function initBusiestSlots() {
    // 只初始化，不绑定事件
}

function initPeakHours() {
    // 只初始化，不绑定事件
}

function initTopDeparture() {
    // 只初始化，不绑定事件
}

function initTopArrival() {
    // 只初始化，不绑定事件
}

// 修改DOMContentLoaded事件处理
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting initialization...');
    initializeAllCharts();
});

// ================= Revenue Section Filter & Chart =================
// 独立于上方所有 filter，仅联动 revenue 板块
(function(){
  // 独立 filter 状态
  const revenueFilters = { time: 'ALL', month: null };
  let revenueRawData = null;

  // 绑定 filter 按钮事件
  document.addEventListener('DOMContentLoaded', function() {
    const btns = document.querySelectorAll('#revenueTrendFilterGroup .revenue-time-filter-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', function() {
        btns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        revenueFilters.time = this.textContent.trim();
        updateRevenueChart();
      });
    });
  });

  // 数据过滤
  function filterRevenueData(rawData) {
    let filtered = rawData;
    if (revenueFilters.time !== 'ALL') {
      filtered = filtered.filter(d => {
        const hour = parseInt((d['Departure Time'] || '').split(':')[0]);
        switch(revenueFilters.time) {
          case 'AM': return hour >= 0 && hour < 12;
          case 'PM': return hour >= 12 && hour < 24;
          case 'Peak': return (hour >= 6 && hour < 9) || (hour >= 16 && hour < 19);
          case 'Off-Peak': return (hour < 6 || hour >= 9) && (hour < 16 || hour >= 19);
          default: return true;
        }
      });
    }
    return filtered;
  }

  // 主动更新 revenue 板块图表
  function updateRevenueChart() {
    if (!revenueRawData) return;
    const filtered = filterRevenueData(revenueRawData);
    drawRevenueTrend(filtered);
    drawRevenueTypeDist(filtered);
    drawJourneyStatusRevenue(filtered);
    drawJourneyStatusRefund(filtered);
    drawTopBottomRoutes(filtered); // 新增：绘制Top/Bottom 5 Routes
    drawDelayRefundBullet(filtered); // 新增：绘制Delay Refund Bullet图
  }

  // 加载数据并初始化
  d3.csv('data/railway.csv').then(data => {
    revenueRawData = data;
    updateRevenueChart();
  });

  // 用户提供的画图函数
  function drawRevenueTrend(data) {
    const svgId = '#chart-revenue-trend';
    d3.select(svgId).selectAll('*').remove();
    // 按月统计净收入和退款
    const monthMap = {}, refundMap = {};
    data.forEach(row => {
      const date = row['Date of Journey'];
      if (!date) return;
      const month = date.slice(0,7); // yyyy-mm
      const price = parseFloat(row['Price']) || 0;
      monthMap[month] = (monthMap[month] || 0) + price;
      if (row['Refund Request'] && row['Refund Request'].toLowerCase() === 'yes') {
        refundMap[month] = (refundMap[month] || 0) + price;
      }
    });
    const months = Object.keys(monthMap).sort();
    const values = months.map(m => monthMap[m]);
    const refunds = months.map(m => refundMap[m] || 0);
    // 英文月份缩写
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthLabels = months.map(m => monthNames[parseInt(m.slice(5,7))-1]);
    // 统计
    const total = d3.sum(values);
    const totalRefund = d3.sum(refunds);
    const maxIdx = values.indexOf(d3.max(values));
    const minIdx = values.indexOf(d3.min(values));
    // 更新统计区
    d3.select('#revenue-total').text('£' + (total/1000).toFixed(0) + 'K');
    d3.select('#revenue-refund').text('£' + (totalRefund/1000).toFixed(0) + 'K');
    // 更新说明区
    let desc = '';
    if (months.length > 0) {
      desc = `In <b>${monthLabels[maxIdx]}</b>, the net revenue peaked at <b>£${values[maxIdx].toLocaleString()}</b>, but experienced a <b>${((values[minIdx]-values[maxIdx])/values[maxIdx]*100).toFixed(0)}% dip</b> in <b>${monthLabels[minIdx]}</b> to <b>£${values[minIdx].toLocaleString()}</b>.`;
      if (months.length > 2) {
        const marIdx = months.length >= 3 ? 2 : 1;
        const pct = ((values[marIdx]-values[marIdx-1])/values[marIdx-1]*100).toFixed(0);
        desc += ` In ${monthLabels[marIdx]}, the net revenue increased to <b>£${values[marIdx].toLocaleString()}</b> with <b>${pct}%</b> and maintained a high level of net revenue in ${monthLabels[months.length-1]}.`;
      }
    }
    d3.select('#revenue-desc').html(desc);
    // 绘制折线图
    // 向左、向下整体平移
    const width = 420, height = 220, margin = {top: 65, right: 30, bottom: 40, left: 48};
    const svg = d3.select(svgId).append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMinYMin meet');
    const x = d3.scalePoint().domain(months).range([margin.left, width-margin.right]);
    const minY = Math.min(...values);
    const maxY = Math.max(...values);
    const y = d3.scaleLinear().domain([minY * 0.98, maxY * 1.02]).range([height-margin.bottom, margin.top]);
    // 区域阴影
    svg.append('path')
      .datum(values)
      .attr('fill','#e0e7ef')
      .attr('opacity',0.7)
      .attr('stroke','none')
      .attr('d',d3.area().x((d,i)=>x(months[i])).y0(y(minY * 0.98)).y1(d=>y(d)));
    // 轴
    svg.append('g').attr('transform',`translate(0,${height-margin.bottom})`).call(d3.axisBottom(x).tickFormat((d,i)=>monthLabels[i])).selectAll('text')
      .style('font-family','Georgia,Times New Roman,serif').style('font-size','13px').style('fill','#222');
    // 折线
    svg.append('path')
      .datum(values)
      .attr('fill','none')
      .attr('stroke','#1e3a8a')
      .attr('stroke-width',4)
      .attr('d',d3.line().x((d,i)=>x(months[i])).y(d=>y(d)).curve(d3.curveMonotoneX));
    // 数据点
    svg.selectAll('circle')
      .data(values)
      .enter().append('circle')
      .attr('cx',(d,i)=>x(months[i]))
      .attr('cy',d=>y(d))
      .attr('r',revenueFilters.month ? 8 : 6)
      .attr('fill',(d,i)=>months[i]===revenueFilters.month?'#ffe69c':'#1e3a8a')
      .attr('stroke','#1e3a8a')
      .attr('stroke-width',2)
      .style('cursor','pointer')
      .on('click',function(e,d){
        if(months[d3.select(this).data()[0]]===revenueFilters.month){
          revenueFilters.month = null;
        }else{
          revenueFilters.month = months[d3.select(this).data()[0]];
        }
        updateRevenueChart();
      })
      .on('mouseover',function(e,d){
        d3.select(this).attr('fill','#ffe69c');
        let tooltip = d3.select('#revenueTrendTooltip');
        if (tooltip.empty()) {
          tooltip = d3.select('body').append('div')
            .attr('id', 'revenueTrendTooltip')
            .attr('class', 'radial-tooltip')
            .style('position', 'absolute')
            .style('pointer-events', 'none')
            .style('background', 'rgba(255,255,255,0.98)')
            .style('border', '1px solid #e5e7eb')
            .style('border-radius', '4px')
            .style('padding', '10px 16px')
            .style('font-family', 'PT Serif, serif')
            .style('font-size', '1rem')
            .style('color', '#222')
            .style('z-index', 1000);
        }
        const i = values.indexOf(d);
        tooltip.html(`<b>${monthLabels[i]}</b><br>Net Revenue: <b>£${d.toLocaleString()}</b>`)
          .style('left', (e.pageX + 14) + 'px')
          .style('top', (e.pageY - 18) + 'px')
          .style('opacity', 1);
      })
      .on('mousemove',function(e){
        d3.select('#revenueTrendTooltip')
          .style('left', (e.pageX + 14) + 'px')
          .style('top', (e.pageY - 18) + 'px');
      })
      .on('mouseout',function(e,d,i){
        d3.select(this).attr('fill',(d,i)=>months[i]===revenueFilters.month?'#ffe69c':'#1e3a8a');
        d3.select('#revenueTrendTooltip').style('opacity', 0);
      });
    // 上下箭头和百分比
    for(let i=1;i<values.length;i++){
      const prev = values[i-1], curr = values[i];
      const x0 = x(months[i]), y0 = y(curr);
      const up = curr>prev;
      const pct = prev ? ((curr-prev)/prev*100).toFixed(1) : '0.0';
      svg.append('text')
        .attr('x',x0)
        .attr('y',y0-18)
        .attr('text-anchor','middle')
        .attr('font-size','14px')
        .attr('font-family','Georgia,Times New Roman,serif')
        .attr('font-weight','bold')
        .attr('fill',up?'#22c55e':'#ef4444')
        .text(up?'▲':'▼');
      svg.append('text')
        .attr('x',x0)
        .attr('y',y0-10)
        .attr('text-anchor','middle')
        .attr('font-size','13px')
        .attr('font-family','Georgia,Times New Roman,serif')
        .attr('fill',up?'#22c55e':'#ef4444')
        .text(`${up?'+':''}${pct}%`);
    }
    // 数值标签，整体向左偏移12px
    svg.selectAll('text.value-label')
      .data(values)
      .enter().append('text')
      .attr('class','value-label')
      .attr('x',(d,i)=>x(months[i])-5)
      .attr('y',d=>y(d)-30)
      .attr('text-anchor','middle')
      .attr('font-size','15px')
      .attr('font-family','Georgia,Times New Roman,serif')
      .attr('fill','#222')
      .attr('font-weight','bold')
      .text(d=>'£'+d.toLocaleString());
  }

  // 新增：票型分布柱状图
  function drawRevenueTypeDist(data) {
    const svgId = '#chart-revenue-type';
    d3.select(svgId).selectAll('*').remove();
    // 票型
    const typeKeys = ['Advance','Anytime','Off-Peak'];
    const typeColors = ['#1e3a8a','#b6b7d8','#888'];
    // 按月统计每票型净收入
    const monthTypeMap = {};
    data.forEach(row => {
      const date = row['Date of Journey'];
      if (!date) return;
      const month = date.slice(0,7); // yyyy-mm
      const type = row['Ticket Type'];
      const price = parseFloat(row['Price']) || 0;
      if (!monthTypeMap[month]) monthTypeMap[month] = {Advance:0,Anytime:0,'Off-Peak':0};
      if (typeKeys.includes(type)) monthTypeMap[month][type] += price;
    });
    const months = Object.keys(monthTypeMap).sort();
    // 统计每月每票型
    const monthTypeArr = months.map(m => typeKeys.map(type => monthTypeMap[m][type]));
    // 票型累计净收入
    const typeTotals = typeKeys.map(type => d3.sum(months.map(m => monthTypeMap[m][type])));
    // 更新右侧统计区
    d3.select('#revenue-advance').attr('style',"font-family: 'Playfair Display', serif; font-size: 2.5rem; font-weight: 900; color: #222; line-height: 0.9;").text('£' + (typeTotals[0]/1000).toFixed(0) + 'K');
    d3.select('#revenue-anytime').attr('style',"font-family: 'Playfair Display', serif; font-size: 2.5rem; font-weight: 900; color: #222; line-height: 0.9;").text('£' + (typeTotals[1]/1000).toFixed(0) + 'K');
    d3.select('#revenue-offpeak').attr('style',"font-family: 'Playfair Display', serif; font-size: 2.5rem; font-weight: 900; color: #222; line-height: 0.9;").text('£' + (typeTotals[2]/1000).toFixed(0) + 'K');
    // 柱状图布局
    const width = 420, height = 220, margin = {top: 60, right: 30, bottom: 40, left: 60};
    const svg = d3.select(svgId).append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMinYMin meet');
    const x0 = d3.scaleBand().domain(months).range([margin.left, width-margin.right]).padding(0.32);
    const x1 = d3.scaleBand().domain(typeKeys).range([0, x0.bandwidth()]).padding(0.18);
    const maxY = d3.max(monthTypeArr.flat()) || 1;
    const y = d3.scaleLinear().domain([0, maxY*1.18]).range([height-margin.bottom, margin.top]);
    // 英文月份缩写
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthLabels = months.map(m => monthNames[parseInt(m.slice(5,7))-1]);
    // 票型高亮
    const selectedType = revenueFilters.ticketType;
    // 票型切换tab
    const tabWrap = d3.select(svgId).append('div').style('display','flex').style('gap','1.2em').style('margin-bottom','-10px').style('margin-left','8px');
    typeKeys.forEach((type,i)=>{
      tabWrap.append('span')
        .style('font-weight',selectedType===type?'bold':(selectedType?400: (i===0?700:400)))
        .style('font-size','1.08em')
        .style('color',selectedType===type?typeColors[i]:(i===0?'#1e3a8a':i===1?'#b6b7d8':'#888'))
        .style('cursor','pointer')
        .style('text-decoration',selectedType===type?'underline':'none')
        .text(type)
        .on('click',()=>{
          if(revenueFilters.ticketType===type){revenueFilters.ticketType=null;}else{revenueFilters.ticketType=type;}
          updateRevenueChart();
        });
      if(i<typeKeys.length-1) tabWrap.append('span').style('color','#888').style('font-weight',400).text(' | ');
    });
    // 柱状图
    svg.selectAll('g.month-group')
      .data(monthTypeArr)
      .enter().append('g')
      .attr('class','month-group')
      .attr('transform',(d,i)=>`translate(${x0(months[i])},0)`)
      .each(function(row, mi){
        d3.select(this).selectAll('rect')
          .data(row)
          .enter().append('rect')
          .attr('x',(d,ti)=>x1(typeKeys[ti]))
          .attr('y',d=>y(d))
          .attr('width',x1.bandwidth())
          .attr('height',d=>y(0)-y(d))
          .attr('fill',(d,ti)=>selectedType? (typeKeys[ti]===selectedType?typeColors[ti]:'#e0e7ef') : typeColors[ti])
          .attr('rx',6)
          .attr('ry',6)
          .style('cursor','pointer')
          .on('click',function(e,d){
            if(revenueFilters.ticketType===typeKeys[this.__data__idx]){revenueFilters.ticketType=null;}else{revenueFilters.ticketType=typeKeys[this.__data__idx];}
            updateRevenueChart();
          })
          .on('mouseover',function(e,d){
            let tooltip = d3.select('#revenueTypeTooltip');
            if (tooltip.empty()) {
              tooltip = d3.select('body').append('div')
                .attr('id', 'revenueTypeTooltip')
                .attr('class', 'radial-tooltip')
                .style('position', 'absolute')
                .style('pointer-events', 'none')
                .style('background', 'rgba(255,255,255,0.98)')
                .style('border', '1px solid #e5e7eb')
                .style('border-radius', '4px')
                .style('padding', '10px 16px')
                .style('font-family', 'PT Serif, serif')
                .style('font-size', '1rem')
                .style('color', '#222')
                .style('z-index', 1000);
            }
            const ti = this.__data__idx;
            tooltip.html(`<b>${monthLabels[mi]}</b><br><b>${typeKeys[ti]}</b> Net Revenue: <b>£${d.toLocaleString()}</b>`)
              .style('left', (e.pageX + 14) + 'px')
              .style('top', (e.pageY - 18) + 'px')
              .style('opacity', 1);
          })
          .on('mousemove',function(e){
            d3.select('#revenueTypeTooltip')
              .style('left', (e.pageX + 14) + 'px')
              .style('top', (e.pageY - 18) + 'px');
          })
          .on('mouseout',function(){
            d3.select('#revenueTypeTooltip').style('opacity', 0);
          })
          .each(function(d,ti){ this.__data__idx = ti; });
        // 金额标签
        d3.select(this).selectAll('text.bar-label')
          .data(row)
          .enter().append('text')
          .attr('class','bar-label')
          .attr('x',(d,ti)=>x1(typeKeys[ti])+x1.bandwidth()/2 + 213)
          .attr('y',(d,ti)=>{
            // Advance, Anytime, Off-Peak 分别错开高度
            if(ti===0) return y(d)-18; // Advance
            if(ti===1) return y(d)-8;  // Anytime
            if(ti===2) return y(d)-15; // Off-Peak
            return y(d)-8;
          })
          .attr('text-anchor','middle')
          .attr('font-size','15px')
          .attr('font-family','Georgia,Times New Roman,serif')
          .attr('font-weight','bold')
          .attr('fill',(d,ti)=>selectedType? (typeKeys[ti]===selectedType?typeColors[ti]:'#bbb') : typeColors[ti])
          .text(d=>d>0?'£'+Math.round(d/1000)+'K':'');
      });
    // X轴
    svg.append('g')
      .attr('transform',`translate(0,${height-margin.bottom})`)
      .call(d3.axisBottom(x0).tickFormat((d,i)=>monthLabels[i]))
      .selectAll('text')
      .attr('font-size', 15)
      .attr('font-family', 'Georgia,Times New Roman,serif')
      .attr('fill', '#222');
    // 描述区
    d3.select('#revenue-type-desc').html(`While <b>Advance</b> tickets revenue, significantly <b>increased in February</b> by <b>40%</b>, the <b>overall net revenue</b> for the month <b>decreased by 20%</b>.<br>The increase in lower-priced Advance ticket sales was offset by a substantial decline in Anytime and Off-Peak ticket revenues, which dropped by <b>52.86%</b> and <b>53.33%</b> respectively. This indicates a potential shift in customer purchasing behavior or market conditions, highlighting the need for a balanced ticketing strategy to maintain overall revenue stability.`);
  }

  // 新增：按 Journey Status 统计净收入条形图
  function drawJourneyStatusRevenue(data) {
    if (!data || data.length === 0) return;
    const svgId = '#chart-journey-status-revenue';
    d3.select(svgId).selectAll('*').remove();
    // 统计各状态净收入
    const statusKeys = ['On Time', 'Delayed', 'Cancelled'];
    const statusColors = ['#b6b7d8', '#a5b4fc', '#e0e7ef'];
    const sums = statusKeys.map(status => d3.sum(data.filter(d => d['Journey Status'] === status), d => parseFloat(d['Price']) || 0));
    const total = d3.sum(sums);
    // 放大比例参数
    const width = 380, height = 90, barH = 18, gap = 12, leftPad = 90;
    const svg = d3.select(svgId).append('svg')
      .attr('width', '100%')
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMinYMin meet');
    // 横向长度加长
    const maxW = 340;
    sums.forEach((v, i) => {
      const y = 10 + i * (barH + gap);
      const w = total > 0 ? v / total * maxW : 0;
      // 判断是否选中
      const isSelected = revenueFilters.journeyStatus === statusKeys[i];
      svg.append('rect')
        .attr('x', leftPad)
        .attr('y', y)
        .attr('width', w)
        .attr('height', barH)
        .attr('fill', statusColors[i])
        .attr('rx', 5).attr('ry', 5)
        .attr('stroke', isSelected ? '#1e293b' : 'none')
        .attr('stroke-width', isSelected ? 2 : 0)
        .style('cursor', 'pointer')
        .on('click', function() {
          if (revenueFilters.journeyStatus === statusKeys[i]) {
            revenueFilters.journeyStatus = null;
          } else {
            revenueFilters.journeyStatus = statusKeys[i];
          }
          updateRevenueChart();
        })
        .on('mouseover', function(e) {
          let tooltip = d3.select('#journeyStatusRevenueTooltip');
          if (tooltip.empty()) {
            tooltip = d3.select('body').append('div')
              .attr('id', 'journeyStatusRevenueTooltip')
              .attr('class', 'radial-tooltip')
              .style('position', 'absolute')
              .style('pointer-events', 'none')
              .style('background', 'rgba(255,255,255,0.98)')
              .style('border', '1px solid #e5e7eb')
              .style('border-radius', '4px')
              .style('padding', '10px 16px')
              .style('font-family', 'PT Serif, serif')
              .style('font-size', '1rem')
              .style('color', '#222')
              .style('z-index', 1000);
          }
          tooltip.html(`<b>${statusKeys[i]}</b><br>Net Revenue: <b>£${Math.round(sums[i]/1000)}K</b><br>Share: <b>${total>0?Math.round(sums[i]/total*100):0}%</b>`)
            .style('left', (e.pageX + 14) + 'px')
            .style('top', (e.pageY - 18) + 'px')
            .style('opacity', 1);
        })
        .on('mousemove', function(e) {
          d3.select('#journeyStatusRevenueTooltip')
            .style('left', (e.pageX + 14) + 'px')
            .style('top', (e.pageY - 18) + 'px');
        })
        .on('mouseout', function() {
          d3.select('#journeyStatusRevenueTooltip').style('opacity', 0);
        });
      svg.append('text')
        .attr('x', leftPad - 8)
        .attr('y', y + barH / 2 + 6)
        .attr('text-anchor', 'end')
        .attr('font-size', '1.08em')
        .attr('fill', '#444')
        .attr('font-family', 'Georgia,Times New Roman,serif')
        .style('cursor', 'pointer')
        .attr('font-weight', isSelected ? 'bold' : 'normal')
        .on('click', function() {
          if (revenueFilters.journeyStatus === statusKeys[i]) {
            revenueFilters.journeyStatus = null;
          } else {
            revenueFilters.journeyStatus = statusKeys[i];
          }
          updateRevenueChart();
        })
        .text(statusKeys[i]);
      // 注释文本自适应位置
      const label = total > 0 ? `£${Math.round(v/1000)}K | ${Math.round(v/total*100)}%` : '';
      svg.append('text')
        .attr('x', leftPad + w + 6)
        .attr('y', y + barH / 2 + 6)
        .attr('text-anchor', 'start')
        .attr('font-size', '1.08em')
        .attr('fill', '#222')
        .attr('font-family', 'Georgia,Times New Roman,serif')
        .attr('font-weight', 'bold')
        .style('cursor', 'pointer')
        .on('click', function() {
          if (revenueFilters.journeyStatus === statusKeys[i]) {
            revenueFilters.journeyStatus = null;
          } else {
            revenueFilters.journeyStatus = statusKeys[i];
          }
          updateRevenueChart();
        })
        .text(label);
    });
    // ====== 动态描述区 ======
    // 找最大占比的状态
    let maxIdx = 0;
    for (let i = 1; i < sums.length; i++) {
      if (sums[i] > sums[maxIdx]) maxIdx = i;
    }
    const mainStatus = statusKeys[maxIdx];
    const mainPct = total > 0 ? Math.round(sums[maxIdx] / total * 100) : 0;
    const otherPct = 100 - mainPct;
    const desc = `<b>${mainStatus}</b> journeys contribute to <b>${mainPct}%</b> of the net revenue, while delayed and cancelled journeys contribute less than <b>${otherPct}%</b>.`;
    d3.select('#journey-status-revenue-desc').html(desc);
  }

  // 新增：按 Journey Status 统计退款条形图
  function drawJourneyStatusRefund(data) {
    if (!data || data.length === 0) return;
    const svgId = '#chart-journey-status-refund';
    d3.select(svgId).selectAll('*').remove();
    // 统计各状态退款
    const statusKeys = ['Delayed', 'Cancelled'];
    const statusColors = ['#b6b7d8', '#e0e7ef'];
    const refundData = data.filter(d => d['Refund Request'] && d['Refund Request'].toLowerCase() === 'yes');
    const sums = statusKeys.map(status => d3.sum(refundData.filter(d => d['Journey Status'] === status), d => parseFloat(d['Price']) || 0));
    const total = d3.sum(sums);
    // 放大比例参数
    const width = 380, height = 60, barH = 18, gap = 12, leftPad = 90;
    const svg = d3.select(svgId).append('svg')
      .attr('width', '100%')
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMinYMin meet');
    // 横向长度加长
    const maxW = 340;
    sums.forEach((v, i) => {
      const y = 10 + i * (barH + gap);
      const w = total > 0 ? v / total * maxW : 0;
      const isSelected = revenueFilters.journeyStatus === statusKeys[i];
      svg.append('rect')
        .attr('x', leftPad)
        .attr('y', y)
        .attr('width', w)
        .attr('height', barH)
        .attr('fill', statusColors[i])
        .attr('rx', 5).attr('ry', 5)
        .attr('stroke', isSelected ? '#1e293b' : 'none')
        .attr('stroke-width', isSelected ? 2 : 0)
        .style('cursor', 'pointer')
        .on('click', function() {
          if (revenueFilters.journeyStatus === statusKeys[i]) {
            revenueFilters.journeyStatus = null;
          } else {
            revenueFilters.journeyStatus = statusKeys[i];
          }
          updateRevenueChart();
        })
        .on('mouseover', function(e) {
          let tooltip = d3.select('#journeyStatusRefundTooltip');
          if (tooltip.empty()) {
            tooltip = d3.select('body').append('div')
              .attr('id', 'journeyStatusRefundTooltip')
              .attr('class', 'radial-tooltip')
              .style('position', 'absolute')
              .style('pointer-events', 'none')
              .style('background', 'rgba(255,255,255,0.98)')
              .style('border', '1px solid #e5e7eb')
              .style('border-radius', '4px')
              .style('padding', '10px 16px')
              .style('font-family', 'PT Serif, serif')
              .style('font-size', '1rem')
              .style('color', '#222')
              .style('z-index', 1000);
          }
          tooltip.html(`<b>${statusKeys[i]}</b><br>Refund: <b>£${Math.round(sums[i]/1000)}K</b><br>Share: <b>${total>0?Math.round(sums[i]/total*100):0}%</b>`)
            .style('left', (e.pageX + 14) + 'px')
            .style('top', (e.pageY - 18) + 'px')
            .style('opacity', 1);
        })
        .on('mousemove', function(e) {
          d3.select('#journeyStatusRefundTooltip')
            .style('left', (e.pageX + 14) + 'px')
            .style('top', (e.pageY - 18) + 'px');
        })
        .on('mouseout', function() {
          d3.select('#journeyStatusRefundTooltip').style('opacity', 0);
        });
      svg.append('text')
        .attr('x', leftPad - 8)
        .attr('y', y + barH / 2 + 6)
        .attr('text-anchor', 'end')
        .attr('font-size', '1.08em')
        .attr('fill', '#444')
        .attr('font-family', 'Georgia,Times New Roman,serif')
        .style('cursor', 'pointer')
        .attr('font-weight', isSelected ? 'bold' : 'normal')
        .on('click', function() {
          if (revenueFilters.journeyStatus === statusKeys[i]) {
            revenueFilters.journeyStatus = null;
          } else {
            revenueFilters.journeyStatus = statusKeys[i];
          }
          updateRevenueChart();
        })
        .text(statusKeys[i]);
      // 注释文本自适应位置
      const label = total > 0 ? `£${Math.round(v/1000)}K | ${Math.round(v/total*100)}%` : '';
      const textElem = svg.append('text')
        .attr('x', leftPad + w - 6)
        .attr('y', y + barH / 2 + 6)
        .attr('text-anchor', 'end')
        .attr('font-size', '1.08em')
        .attr('fill', '#222')
        .attr('font-family', 'Georgia,Times New Roman,serif')
        .attr('font-weight', 'bold')
        .style('cursor', 'pointer')
        .on('click', function() {
          if (revenueFilters.journeyStatus === statusKeys[i]) {
            revenueFilters.journeyStatus = null;
          } else {
            revenueFilters.journeyStatus = statusKeys[i];
          }
          updateRevenueChart();
        })
        .text(label);
      if (label && textElem.node() && textElem.node().getComputedTextLength() > w - 12) {
        textElem
          .attr('x', leftPad + w + 6)
          .attr('text-anchor', 'start');
      }
    });
    // ====== 动态描述区 ======
    // 找最大退款状态
    let maxIdx = 0;
    for (let i = 1; i < sums.length; i++) {
      if (sums[i] > sums[maxIdx]) maxIdx = i;
    }
    const mainStatus = statusKeys[maxIdx];
    const mainVal = sums[maxIdx];
    const mainPct = total > 0 ? Math.round(mainVal / total * 100) : 0;
    const otherStatus = statusKeys[1 - maxIdx];
    const otherPct = 100 - mainPct;
    // 金额格式化
    function formatMoney(val) {
      return '£' + val.toLocaleString();
    }
    // 动态描述
    const desc = `<b>${mainStatus}</b> journeys, refunds totaling <b>${formatMoney(mainVal)}</b> constitute <b>${mainPct}%</b> of all refunds, compared to <b>${otherPct}%</b> of refunds from <b>${otherStatus.toLowerCase()}</b>s.<br>In all, <b>Delayed</b> journeys are more likely to be refunded than <b>cancelled</b> journeys.`;
    d3.select('#journey-status-refund-desc').html(desc);
  }

  // 新增：Top/Bottom 5 Routes 图表
  function drawTopBottomRoutes(data) {
    if (!data || data.length === 0) return;

    // Calculate revenue for each route
    const routeRevenue = {};
    data.forEach(row => {
      // Skip invalid entries
      if (!row['Departure Station'] || !row['Arrival Destination'] || 
          row['Departure Station'] === 'undefined' || row['Arrival Destination'] === 'undefined') {
        return;
      }
      const route = `${row['Departure Station']} to ${row['Arrival Destination']}`;
      const price = parseFloat(row['Price']) || 0;
      if (price > 0) { // Only include routes with valid prices
        routeRevenue[route] = (routeRevenue[route] || 0) + price;
      }
    });

    // Convert to array and sort
    const routes = Object.entries(routeRevenue)
      .filter(([route, revenue]) => revenue > 0) // Filter out zero revenue routes
      .map(([route, revenue]) => ({
        route,
        revenue
      }));
    routes.sort((a, b) => b.revenue - a.revenue);

    // Get top 5 and bottom 5
    const top5 = routes.slice(0, 5);
    const bottom5 = routes.slice(-5).reverse();

    // Draw chart function
    const drawRouteChart = (data, elementId, isTop) => {
      const width = 280;
      const height = 360;
      const margin = { top: 30, right: 5, bottom: 20, left: 0 }; // Reduced right margin
      const barHeight = 38; // Decreased bar height from 48px
      const gap = 35; // Decreased gap between bars from 45px

      // Clear existing content
      const container = d3.select('#' + elementId);
      container.selectAll('*').remove();

      // Create SVG
      const svg = container.append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMinYMin meet');

      // Create scale
      const maxRevenue = d3.max(data, d => d.revenue);
      const x = d3.scaleLinear()
        .domain([0, maxRevenue])
        .range([0, width - margin.left - margin.right - 8]);

      // Draw bars
      data.forEach((d, i) => {
        const g = svg.append('g')
          .attr('transform', `translate(${margin.left}, ${margin.top + i * (barHeight + gap)})`);

        // Route name (above the bar)
        g.append('text')
          .attr('x', 4)
          .attr('y', -8)
          .attr('fill', '#374151')
          .attr('font-size', '0.8rem')
          .attr('font-family', 'Georgia,Times New Roman,serif')
          .text(d.route);

        // Background bar
        const bgRect = g.append('rect')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', width - margin.left - margin.right)
          .attr('height', barHeight)
          .attr('fill', '#f8f6f1')
          .attr('rx', 4)
          .attr('ry', 4);

        // Data bar
        const dataRect = g.append('rect')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', x(d.revenue))
          .attr('height', barHeight)
          .attr('fill', isTop ? '#b6b7d8' : '#e0e7ef')
          .attr('rx', 4)
          .attr('ry', 4)
          .style('cursor', 'pointer')
          .on('mouseover', function(e) {
            d3.select(this).attr('fill', '#1e3a8a');
            // Add tooltip
            let tooltip = d3.select('#routeTooltip');
            if (tooltip.empty()) {
              tooltip = d3.select('body').append('div')
                .attr('id', 'routeTooltip')
                .attr('class', 'radial-tooltip')
                .style('position', 'absolute')
                .style('pointer-events', 'none')
                .style('background', 'rgba(255,255,255,0.98)')
                .style('border', '1px solid #e5e7eb')
                .style('border-radius', '4px')
                .style('padding', '10px 16px')
                .style('font-family', 'PT Serif, serif')
                .style('font-size', '1rem')
                .style('color', '#222')
                .style('z-index', 1000);
            }
            tooltip.html(`<b>${d.route}</b><br>Revenue: <b>£${Math.round(d.revenue/1000)}K</b>`)
              .style('left', (e.pageX + 14) + 'px')
              .style('top', (e.pageY - 18) + 'px')
              .style('opacity', 1);
          })
          .on('mousemove', function(e) {
            d3.select('#routeTooltip')
              .style('left', (e.pageX + 14) + 'px')
              .style('top', (e.pageY - 18) + 'px');
          })
          .on('mouseout', function() {
            d3.select(this).attr('fill', isTop ? '#b6b7d8' : '#e0e7ef');
          })
          .on('click', function() {
            const [departure, arrival] = d.route.split(' to ');
            if (filters.departureStation === departure && filters.arrivalDestination === arrival) {
              filters.departureStation = null;
              filters.arrivalDestination = null;
            } else {
              filters.departureStation = departure;
              filters.arrivalDestination = arrival;
            }
            updateAllCharts();
            if (typeof updateFilterTags === 'function') updateFilterTags();
          });

        // Revenue amount
        const revenue = d.revenue >= 1000 ? 
          `£${Math.round(d.revenue/1000)}K` : 
          `£${Math.round(d.revenue)}`;

        g.append('text')
          .attr('x', x(d.revenue) - 8)
          .attr('y', barHeight / 2 + 6)
          .attr('fill', '#1e293b')
          .attr('font-size', '1.0rem')
          .attr('text-anchor', 'end')
          .attr('font-weight', 'bold')
          .attr('font-family', 'Georgia,Times New Roman,serif')
          .text(revenue);
      });
    };

    // Draw both charts
    drawRouteChart(top5, 'chart-top-routes', true);
    drawRouteChart(bottom5, 'chart-bottom-routes', false);
  }

  // 新增：Delay Refund Bullet 图表
  function drawDelayRefundBullet(data) {
    if (!data || data.length === 0) return;

    // Clear any existing filters that might affect the visualization
    const originalJourneyStatus = revenueFilters.journeyStatus;
    revenueFilters.journeyStatus = null;

    // Process data for delay categories
    const delayCategories = [
      { label: '<= 1 Min', min: 0, max: 1 },
      { label: '1 - 5 Mins', min: 1, max: 5 },
      { label: '5 - 15 Mins', min: 5, max: 15 },
      { label: '15 - 30 Mins', min: 15, max: 30 },
      { label: '30 - 60 Mins', min: 30, max: 60 },
      { label: '> 60 Mins', min: 60, max: Infinity }
    ];

    // Helper function to parse time string to minutes since midnight
    function getMinutes(timeStr) {
      if (!timeStr) return 0;
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    }

    // Calculate metrics for each category
    const categoryData = delayCategories.map(cat => {
      const categoryRows = data.filter(row => {
        // Only process Delayed status for delay categories
        if (row['Journey Status'] !== 'Delayed') return false;

        const scheduledTime = getMinutes(row['Arrival Time']);
        const actualTime = getMinutes(row['Actual Arrival Time']);
        
        // Calculate delay minutes
        let delayMins = actualTime - scheduledTime;
        
        // Handle overnight delays (e.g. scheduled 23:45, actual 00:15)
        if (delayMins < -720) { // More than 12 hours negative
          delayMins += 1440; // Add 24 hours
        } else if (delayMins > 720) { // More than 12 hours positive
          delayMins -= 1440; // Subtract 24 hours
        }

        // Match delay category
        return delayMins > cat.min && delayMins <= cat.max;
      });

      // Calculate total revenue (sum of all prices in category)
      const totalRevenue = d3.sum(categoryRows, d => {
        const price = parseFloat(d['Price']);
        return isNaN(price) ? 0 : price;
      });

      // Calculate refund amount (sum of prices where Refund Request is 'Yes')
      const refund = d3.sum(categoryRows.filter(d => 
        d['Refund Request'] && d['Refund Request'].trim().toLowerCase() === 'yes'
      ), d => {
        const price = parseFloat(d['Price']);
        return isNaN(price) ? 0 : price;
      });

      // Calculate net revenue
      const netRevenue = totalRevenue - refund;

      // Calculate refund percentage
      const refundPercent = totalRevenue > 0 ? (refund / totalRevenue * 100) : 0;

      return {
        ...cat,
        totalRevenue,
        netRevenue,
        refund,
        refundPercent,
        count: categoryRows.length
      };
    });

    // Setup chart dimensions
    const width = 620;
    const height = 380;
    const margin = { top: 40, right: 100, bottom: 40, left: 100 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const barHeight = 30;
    const barPadding = 15;

    // Clear existing content
    const container = d3.select('#delay-refund-chart');
    container.selectAll('*').remove();

    // Create SVG with viewBox for better responsiveness
    const svg = container.append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Create scales
    const maxRevenue = d3.max(categoryData, d => d.totalRevenue) || 1000;
    const x = d3.scaleLinear()
      .domain([0, maxRevenue * 1.1])
      .range([0, innerWidth]);

    // Draw bullet bars for each category
    categoryData.forEach((d, i) => {
      const g = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top + i * (barHeight + barPadding)})`);

      // Total Revenue bar (background)
      g.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', Math.max(0, x(d.totalRevenue)))
        .attr('height', barHeight)
        .attr('fill', '#b6b7d8')
        .attr('rx', 4);

      // Net Revenue bar
      g.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', Math.max(0, x(d.netRevenue)))
        .attr('height', barHeight)
        .attr('fill', '#1e3a8a')
        .attr('rx', 4);

      // Refund marker line
      if (d.refund > 0) {
        g.append('line')
          .attr('x1', x(d.refund))
          .attr('x2', x(d.refund))
          .attr('y1', 0)
          .attr('y2', barHeight)
          .attr('stroke', '#e0e7ef')
          .attr('stroke-width', 2);
      }

      // Category label
      g.append('text')
        .attr('x', -10)
        .attr('y', barHeight / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('font-family', 'Georgia,Times New Roman,serif')
        .attr('font-size', '0.9rem')
        .attr('fill', '#374151')
        .text(d.label);

      // Refund percentage
      g.append('text')
        .attr('x', innerWidth + 30)
        .attr('y', barHeight / 2)
        .attr('dominant-baseline', 'middle')
        .attr('font-family', 'Georgia,Times New Roman,serif')
        .attr('font-size', '0.9rem')
        .attr('fill', '#374151')
        .text(`${Math.round(d.refundPercent)}%`);

      // Total Revenue amount
      if (d.totalRevenue > 0) {
        g.append('text')
          .attr('x', x(d.totalRevenue) + 5)
          .attr('y', barHeight / 2)
          .attr('dominant-baseline', 'middle')
          .attr('font-family', 'Georgia,Times New Roman,serif')
          .attr('font-size', '0.8rem')
          .attr('fill', '#666')
          .text(`£${d3.format(",.0f")(d.totalRevenue)}`);
      }
    });

    // Add "Delayed Minutes" title
    svg.append('text')
      .attr('x', margin.left + 40)
      .attr('y', margin.top - 20)
      .attr('text-anchor', 'end')
      .attr('font-family', 'Georgia,Times New Roman,serif')
      .attr('font-size', '0.9rem')
      .attr('font-weight', 'bold')
      .attr('fill', '#374151')
      .text('Delayed Minutes');

    // Add legend
    const legend = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${height - 35})`);

    // Total Revenue legend
    legend.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', '#b6b7d8');

    legend.append('text')
      .attr('x', 20)
      .attr('y', 10)
      .attr('font-family', 'Georgia,Times New Roman,serif')
      .attr('font-size', '0.8rem')
      .text('Total Revenue');

    // Net Revenue legend
    legend.append('rect')
      .attr('x', 120)
      .attr('y', 0)
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', '#1e3a8a');

    legend.append('text')
      .attr('x', 140)
      .attr('y', 10)
      .attr('font-family', 'Georgia,Times New Roman,serif')
      .attr('font-size', '0.8rem')
      .text('Net Revenue');

    // Refund legend
    legend.append('line')
      .attr('x1', 240)
      .attr('x2', 252)
      .attr('y1', 6)
      .attr('y2', 6)
      .attr('stroke', '#e0e7ef')
      .attr('stroke-width', 2);

    legend.append('text')
      .attr('x', 260)
      .attr('y', 10)
      .attr('font-family', 'Georgia,Times New Roman,serif')
      .attr('font-size', '0.8rem')
      .text('Refund Amount');

    // Restore original filter state
    revenueFilters.journeyStatus = originalJourneyStatus;

    // 写入描述文字
    d3.select('#delay-refund-desc').html(
      `More journeys are refunded due to short delay than long delay.<br>Shorter delays often result in higher refund percentages, with <b>&lt; 1 min</b> having the highest at <b>76%</b>. In contrast, longer delays show significantly lower refund impacts, such as <b>&gt; 60 mins at 0%</b> and <b>30 - 60 mins at 2%</b>.`
    );
  }
})();
// ================= End Revenue Section =================

// Add this helper function after updateCountryDetails
function getServiceScore(operators) {
    if (!operators || !operators.length) return '-';
    // 取四项平均
    const scores = operators.map(op => {
        const c = parseFloat(op.compensation ?? op['Compensation Policy Score (/10)']) || 0;
        const b = parseFloat(op.booking ?? op['Booking Experience Score (/10)']) || 0;
        const n = parseFloat(op.night ?? op['Night Train Offer Score (/10)']) || 0;
        const y = parseFloat(op.cycling ?? op['Cycling Policy Score (/10)']) || 0;
        return (c + b + n + y) / 4;
    });
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return avg.toFixed(1) + '/10';
}

// ... existing code ...
// ================= Parallel Sets Visualization =================
// Initialize Parallel Sets visualization
function initParallelSets() {
  // Get select elements
  const originSelect = document.getElementById('origin-city-select');
  const destSelect = document.getElementById('destination-city-select');

  if (!originSelect || !destSelect) return;

  // Initialize multiple select with Choices.js
  const originChoices = new Choices(originSelect, {
    removeItemButton: true,
    maxItemCount: 5,
    searchEnabled: true,
    renderChoiceLimit: 10,
    placeholder: true,
    placeholderValue: 'Select origin cities...'
  });

  const destChoices = new Choices(destSelect, {
    removeItemButton: true,
    maxItemCount: 5,
    searchEnabled: true,
    renderChoiceLimit: 10,
    placeholder: true,
    placeholderValue: 'Select destination cities...'
  });

  // 自动填充选项
  if (window.rawData && window.rawData.length > 0) {
    const originCities = Array.from(new Set(window.rawData.map(d => d['Departure Station'] && d['Departure Station'].split(' ')[0]).filter(Boolean)));
    const destCities = Array.from(new Set(window.rawData.map(d => d['Arrival Destination'] && d['Arrival Destination'].split(' ')[0]).filter(Boolean)));
    originCities.forEach(city => {
      const option = document.createElement('option');
      option.value = city;
      option.text = city;
      originSelect.appendChild(option);
    });
    destCities.forEach(city => {
      const option = document.createElement('option');
      option.value = city;
      option.text = city;
      destSelect.appendChild(option);
    });
  }

  // Set default selections (London and Manchester as origin, York and Liverpool as destination)
  originSelect.value = 'London';
  destSelect.value = 'York';
  
  // Trigger the change event to update the visualization
  const event = new Event('change');
  originSelect.dispatchEvent(event);
  destSelect.dispatchEvent(event);

  // Event listeners for selection changes
  originSelect.addEventListener('change', updateParallelSets);
  destSelect.addEventListener('change', updateParallelSets);

  // Force initial update with default selections
  updateParallelSets();
}

function updateParallelSets() {
  if (!window.rawData) return;

  const originSelect = document.getElementById('origin-city-select');
  const destSelect = document.getElementById('destination-city-select');
  
  if (!originSelect || !destSelect) return;

  const originCities = Array.from(originSelect.selectedOptions).map(opt => opt.value);
  const destCities = Array.from(destSelect.selectedOptions).map(opt => opt.value);
  
  if (originCities.length === 0 || destCities.length === 0) return;

  // First filter by selected cities
  let filteredData = window.rawData.filter(d => 
    originCities.some(city => d['Departure Station'] && d['Departure Station'].startsWith(city)) && 
    destCities.some(city => d['Arrival Destination'] && d['Arrival Destination'].startsWith(city))
  );

  // Then apply time filters if available
  if (typeof applyFilters === 'function') {
    filteredData = applyFilters(filteredData);
  }

  drawParallelSets(filteredData);
}

function drawParallelSets(data) {
  if (!data || data.length === 0) return;

  // Clear previous chart
  const container = d3.select('#parallel-sets-chart');
  container.selectAll('*').remove();

  // Dimensions and margins
  const margin = {top: 80, right: 60, bottom: 80, left: 60};
  const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
  const height = container.node().getBoundingClientRect().height - margin.top - margin.bottom;

  // Create SVG
  const svg = container.append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Process data for parallel sets
  const dimensions = [
    {name: 'Origin City', key: 'Departure Station', getValue: d => d['Departure Station'] ? d['Departure Station'].split(' ')[0] : ''},
    {name: 'Origin Station', key: 'Departure Station', getValue: d => d['Departure Station']},
    {name: 'Destination Station', key: 'Arrival Destination', getValue: d => d['Arrival Destination']},
    {name: 'Refund Result', key: 'Refund Request', getValue: d => d['Refund Request'] && d['Refund Request'].toLowerCase() === 'yes' ? 'Refunded' : 'Not Refunded'}
  ];

  // Calculate unique values for each dimension
  const dimensionValues = dimensions.map(dim => {
    const values = Array.from(new Set(data.map(dim.getValue).filter(Boolean)));
    return {
      name: dim.name,
      values: values,
      scale: d3.scalePoint()
        .domain(values)
        .range([0, height])
    };
  });

  // Create axes
  const xScale = d3.scalePoint()
    .domain(dimensions.map(d => d.name))
    .range([0, width]);

  // Draw axes
  dimensions.forEach((dim, i) => {
    const axis = d3.axisLeft(dimensionValues[i].scale);
    svg.append('g')
      .attr('transform', `translate(${xScale(dim.name)},0)`)
      .call(axis)
      .call(g => g.selectAll('text')
        .attr('font-family', 'Georgia,Times New Roman,serif')
        .attr('font-size', '0.8rem')
        .attr('fill', '#374151'));

    // Add dimension titles
    svg.append('text')
      .attr('x', xScale(dim.name))
      .attr('y', -60)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'Georgia,Times New Roman,serif')
      .attr('font-size', '0.9rem')
      .attr('font-weight', 'bold')
      .attr('fill', '#374151')
      .text(dim.name);
  });

  // Calculate links between dimensions
  const links = [];
  for (let i = 0; i < dimensions.length - 1; i++) {
    const source = dimensions[i];
    const target = dimensions[i + 1];
    
    // Group data by source and target values
    const groups = d3.group(data, 
      d => source.getValue(d),
      d => target.getValue(d)
    );

    // Create links
    groups.forEach((targetGroups, sourceValue) => {
      targetGroups.forEach((group, targetValue) => {
        links.push({
          source: {
            dimension: source.name,
            value: sourceValue,
            y: dimensionValues[i].scale(sourceValue)
          },
          target: {
            dimension: target.name,
            value: targetValue,
            y: dimensionValues[i + 1].scale(targetValue)
          },
          count: group.length,
          refundPercent: d3.mean(group, d => d['Refund Request'] && d['Refund Request'].toLowerCase() === 'yes' ? 1 : 0) * 100
        });
      });
    });
  }

  // Color scale for refund percentage
  const colorScale = d3.scaleSequential()
    .domain([0, 100])
    .interpolator(d3.interpolate('#b6b7d8', '#1e3a8a'));

  // Draw links
  svg.selectAll('.link')
    .data(links)
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('d', d => {
      const x0 = xScale(d.source.dimension);
      const x1 = xScale(d.target.dimension);
      const y0 = d.source.y;
      const y1 = d.target.y;
      return `M${x0},${y0} C${(x0 + x1) / 2},${y0} ${(x0 + x1) / 2},${y1} ${x1},${y1}`;
    })
    .attr('fill', 'none')
    .attr('stroke', d => colorScale(d.refundPercent))
    .attr('stroke-width', d => Math.max(1, Math.sqrt(d.count)))
    .attr('opacity', 0.6)
    .on('mouseover', function(event, d) {
      d3.select(this)
        .attr('opacity', 1)
        .attr('stroke-width', d => Math.max(2, Math.sqrt(d.count) * 1.5));

      // Show tooltip
      const tooltip = d3.select('body').append('div')
        .attr('class', 'parallel-sets-tooltip')
        .style('position', 'absolute')
        .style('background', '#fff')
        .style('padding', '8px')
        .style('border', '1px solid #ddd')
        .style('border-radius', '4px')
        .style('font-family', 'Georgia,Times New Roman,serif')
        .style('font-size', '0.9rem')
        .style('pointer-events', 'none')
        .style('z-index', 1000);

      tooltip.html(`
        <div><strong>${d.source.dimension}:</strong> ${d.source.value}</div>
        <div><strong>${d.target.dimension}:</strong> ${d.target.value}</div>
        <div><strong>Count:</strong> ${d.count}</div>
        <div><strong>Refund %:</strong> ${d.refundPercent.toFixed(1)}%</div>
      `);

      // Position tooltip
      tooltip.style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px');
    })
    .on('mouseout', function() {
      d3.select(this)
        .attr('opacity', 0.6)
        .attr('stroke-width', d => Math.max(1, Math.sqrt(d.count)));
      d3.selectAll('.parallel-sets-tooltip').remove();
    });

  // Add legend for refund percentage
  const legendWidth = 150;
  const legendHeight = 10;
  
  const legendScale = d3.scaleLinear()
    .domain([0, 100])
    .range([0, legendWidth]);

  const legendAxis = d3.axisBottom(legendScale)
    .ticks(5)
    .tickFormat(d => d + '%');

  const legend = svg.append('g')
    .attr('transform', `translate(${width - legendWidth +10},${height - legendHeight + 50})`);

  // Create gradient
  const gradient = legend.append('defs')
    .append('linearGradient')
    .attr('id', 'refund-gradient')
    .attr('x1', '0%')
    .attr('x2', '100%');

  gradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', '#b6b7d8');

  gradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', '#1e3a8a');

  // Draw legend rectangle
  legend.append('rect')
    .attr('width', legendWidth)
    .attr('height', legendHeight)
    .style('fill', 'url(#refund-gradient)');

  // Add legend axis
  legend.append('g')
    .attr('transform', `translate(0,${legendHeight})`)
    .call(legendAxis)
    .call(g => g.selectAll('text')
      .attr('font-family', 'Georgia,Times New Roman,serif')
      .attr('font-size', '0.8rem')
      .attr('fill', '#374151'));

  // Add legend title
  legend.append('text')
    .attr('x', 0)
    .attr('y', -5)
    .attr('font-family', 'Georgia,Times New Roman,serif')
    .attr('font-size', '0.8rem')
    .attr('fill', '#374151')
    .text('Refund Percentage');
}

// 数据加载后初始化
if (typeof Papa !== 'undefined') {
  Papa.parse('data/railway.csv', {
    header: true,
    download: true,
    complete: function(results) {
      window.rawData = results.data;
      updateServiceStatusCounts();
      initParallelSets();
    }
  });
}
// ... existing code ...

// ... existing code ...
// Service Status Overview updater
function updateServiceStatusCounts() {
  if (!window.rawData) return;
  const rawData = window.rawData;
  const totalServices = rawData.length;
  const statusCounts = {
    onTime: rawData.filter(row => row['Journey Status'] === 'On Time').length,
    delayed: rawData.filter(row => row['Journey Status'] === 'Delayed').length,
    cancelled: rawData.filter(row => row['Journey Status'] === 'Cancelled').length
  };
  document.getElementById('planned-services').textContent = totalServices.toLocaleString();
  document.getElementById('ontime-services').textContent = statusCounts.onTime.toLocaleString();
  document.getElementById('delayed-services').textContent = statusCounts.delayed.toLocaleString();
  document.getElementById('cancelled-services').textContent = statusCounts.cancelled.toLocaleString();
}

// 数据加载后初始化
if (typeof Papa !== 'undefined') {
  Papa.parse('data/railway.csv', {
    header: true,
    download: true,
    complete: function(results) {
      window.rawData = results.data;
      updateServiceStatusCounts();
      initParallelSets();
    }
  });
}
// ... existing code ...

// --- Horizon Chart for Monthly Cancellations ---
function getMonthName(dateStr) {
  const months = {
    '01': 'January', '02': 'February', '03': 'March', '04': 'April',
    '05': 'May', '06': 'June', '07': 'July', '08': 'August',
    '09': 'September', '10': 'October', '11': 'November', '12': 'December'
  };
  const monthNum = dateStr.slice(5, 7);
  return months[monthNum];
}

function processMonthlyCancellationData(data) {
  const monthlyMap = new Map();
  data.forEach(row => {
    const date = row['Date of Journey'];
    if (!date) return;
    const month = date.slice(0, 7); // YYYY-MM
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, {
        count: 0,
        total: 0,
        displayMonth: getMonthName(month)
      });
    }
    const monthData = monthlyMap.get(month);
    monthData.total++;
    if (row['Journey Status'] === 'Cancelled') {
      monthData.count++;
    }
  });
  const monthlyData = Array.from(monthlyMap, ([month, data]) => ({
    month: month,
    displayMonth: data.displayMonth,
    count: data.count,
    total: data.total,
    percentChange: 0
  })).sort((a, b) => a.month.localeCompare(b.month));
  for (let i = 1; i < monthlyData.length; i++) {
    const prev = monthlyData[i - 1].count;
    const curr = monthlyData[i].count;
    monthlyData[i].percentChange = prev ? Number(((curr - prev) / prev * 100).toFixed(2)) : 0;
  }
  return monthlyData;
}

function drawHorizonChart(data) {
  const monthlyData = processMonthlyCancellationData(data);
  // Calculate total cancellation percentage
  const totalJourneys = data.length;
  const totalCancellations = data.filter(d => d['Journey Status'] === 'Cancelled').length;
  const cancellationScore = totalJourneys ? ((totalCancellations / totalJourneys) * 100).toFixed(2) : '-';
  // Find highest and lowest months
  const sortedData = [...monthlyData].sort((a, b) => b.count - a.count);
  const highest = sortedData[0] || {displayMonth:'-',count:'-',percentChange:'-'};
  const lowest = sortedData[sortedData.length - 1] || {displayMonth:'-',count:'-',percentChange:'-'};
  // Update the insight text
  document.getElementById('cancellation-score').textContent = `${cancellationScore}%`;
  document.getElementById('highest-month').textContent = highest.displayMonth;
  document.getElementById('highest-count').textContent = highest.count;
  document.getElementById('highest-percent').textContent = `${highest.percentChange}%`;
  document.getElementById('lowest-month').textContent = lowest.displayMonth;
  document.getElementById('lowest-count').textContent = lowest.count;
  document.getElementById('lowest-percent').textContent = `${lowest.percentChange}%`;
  // Draw the horizon/stacked area chart
  const container = d3.select('#horizon-chart');
  container.selectAll('*').remove();
  const width = 620, height = 210, margin = {top: 18, right: 18, bottom: 38, left: 18};
  const svg = container.append('svg')
    .attr('width', width)
    .attr('height', height);
  const x = d3.scalePoint()
    .domain(monthlyData.map(d => d.displayMonth))
    .range([margin.left, width - margin.right])
    .padding(0.8); // Add padding so first/last label are fully visible
  const y = d3.scaleLinear()
    .domain([0, d3.max(monthlyData, d => d.count) * 1.15 || 1])
    .range([height - margin.bottom, margin.top]);
  // Area layers (horizon effect) with fixed color palette
  const colors = ['#b6b7d8', '#8e8fc7', '#6668b5', '#1e3a8a'];
  const nLayers = colors.length;
  for (let i = 0; i < nLayers; i++) {
    const area = d3.area()
      .x((d, idx) => x(d.displayMonth))
      .y0((d) => y((d.count / nLayers) * i))
      .y1((d) => y((d.count / nLayers) * (i + 1)))
      .curve(d3.curveBasis);
    svg.append('path')
      .datum(monthlyData)
      .attr('fill', colors[i])
      .attr('opacity', 0.85)
      .attr('d', area);
  }
  // X axis
  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickSize(0))
    .selectAll('text')
    .attr('font-family', 'Georgia,Times New Roman,serif')
    .attr('font-size', '0.95rem')
    .attr('fill', '#222');
  // Y axis (hidden, for spacing)
  // (Do not append the y-axis group, so no vertical line is shown)
  // --- Remove border (no rect) ---

  // --- Tooltip on hover for each month ---
  const tooltip = d3.select('body').append('div')
    .attr('class', 'horizon-tooltip')
    .style('position', 'absolute')
    .style('background', '#fff')
    .style('border', '1px solid #ddd')
    .style('border-radius', '4px')
    .style('padding', '8px 14px')
    .style('font-family', 'Georgia,Times New Roman,serif')
    .style('font-size', '1rem')
    .style('color', '#222')
    .style('box-shadow', '0 2px 8px rgba(0,0,0,0.12)')
    .style('pointer-events', 'none')
    .style('z-index', 1000)
    .style('visibility', 'hidden');

  // Add invisible rects for each month for hover
  const barWidth = (width - margin.left - margin.right) / monthlyData.length;
  svg.selectAll('.hover-rect')
    .data(monthlyData)
    .enter()
    .append('rect')
    .attr('class', 'hover-rect')
    .attr('x', d => x(d.displayMonth) - barWidth/2)
    .attr('y', margin.top)
    .attr('width', barWidth)
    .attr('height', height - margin.top - margin.bottom)
    .attr('fill', 'transparent')
    .on('mousemove', function(event, d) {
      tooltip.style('visibility', 'visible')
        .html(`<b>${d.displayMonth}</b><br>Cancellations: <b>${d.count}</b>`)
        .style('left', (event.pageX + 16) + 'px')
        .style('top', (event.pageY - 32) + 'px');
      d3.select(this).attr('cursor', 'pointer');
    })
    .on('mouseout', function() {
      tooltip.style('visibility', 'hidden');
    });
}
// ... existing code ...

// --- Filter logic for performanceFilterGroup ---
function getPerformanceFilteredData() {
  if (!window.rawData) return [];
  const filterBtns = document.querySelectorAll('#performanceFilterGroup .time-filter-btn');
  let filter = 'ALL';
  filterBtns.forEach(btn => { if (btn.classList.contains('active')) filter = btn.textContent.trim(); });
  if (filter === 'ALL') return window.rawData;
  return window.rawData.filter(row => {
    const hour = parseInt((row['Departure Time']||'').split(':')[0]);
    switch(filter) {
      case 'AM': return hour >= 0 && hour < 12;
      case 'PM': return hour >= 12 && hour < 24;
      case 'Peak': return (hour >= 6 && hour < 9) || (hour >= 16 && hour < 19);
      case 'Off-Peak': return (hour < 6 || hour >= 9) && (hour < 16 || hour >= 19);
      default: return true;
    }
  });
}

// --- Update horizon chart on filter change ---
function updateHorizonChart() {
  const filtered = getPerformanceFilteredData();
  drawHorizonChart(filtered);
}

// --- Bind filter buttons ---
document.addEventListener('DOMContentLoaded', () => {
  const perfBtns = document.querySelectorAll('#performanceFilterGroup .time-filter-btn');
  perfBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      perfBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateServiceStatusCounts();
      updateHorizonChart();
    });
  });
  // Initial render
  updateHorizonChart();
});

// Also update on data load
if (typeof Papa !== 'undefined') {
  Papa.parse('data/railway.csv', {
    header: true,
    download: true,
    complete: function(results) {
      window.rawData = results.data;
      updateServiceStatusCounts();
      updateHorizonChart();
      initParallelSets && initParallelSets();
    }
  });
}
// ... existing code ...

// ... existing code ...
// --- On-Time Services Lollipop Chart ---
function processMonthlyOnTimeData(data) {
  // Group by month and count on-time services
  const monthlyData = d3.group(data.filter(d => d['Journey Status'] === 'On Time'), d => {
    const date = new Date(d['Date of Journey']);
    return date.getMonth(); // 0-11 for Jan-Dec
  });
  // Only show Jan-April for demo
  const months = ['January', 'February', 'March', 'April'];
  const monthlyArray = months.map((month, idx) => {
    const services = monthlyData.get(idx) || [];
    return {
      month: month,
      count: services.length || 0
    };
  });
  // Calculate month-over-month change
  monthlyArray.forEach((d, i) => {
    if (i > 0) {
      const prevCount = monthlyArray[i - 1].count;
      d.change = prevCount > 0 ? ((d.count - prevCount) / prevCount * 100).toFixed(1) : "0.0";
    } else {
      d.change = "0.0";
    }
  });
  return monthlyArray;
}

function drawLollipopChart(data) {
  const monthlyData = processMonthlyOnTimeData(data);
  d3.select("#lollipop-on-time").html("");
  const margin = {top: 10, right: 20, bottom: 45, left: 20};
  const width = document.getElementById("lollipop-on-time").clientWidth - margin.left - margin.right;
  const height = 160;
  const svg = d3.select("#lollipop-on-time")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3.scaleBand()
    .domain(monthlyData.map(d => d.month))
    .range([0, width])
    .padding(0.6);
  const minCount = d3.min(monthlyData, d => d.count || 0);
  const maxCount = d3.max(monthlyData, d => d.count || 0);
  const range = maxCount - minCount;
  const y = d3.scaleLinear()
    .domain([minCount - range * 0.1, maxCount + range * 0.1])
    .range([height, 0]);
  // Area
  const area = d3.area()
    .x(d => x(d.month) + x.bandwidth() / 2)
    .y0(height)
    .y1(d => y(d.count))
    .curve(d3.curveMonotoneX);
  svg.append("path")
    .datum(monthlyData)
    .attr("class", "area")
    .attr("d", area)
    .style("fill", "#e8eaf6")
    .style("opacity", 0.5);
  // Line
  const line = d3.line()
    .x(d => x(d.month) + x.bandwidth() / 2)
    .y(d => y(d.count))
    .curve(d3.curveMonotoneX);
  svg.append("path")
    .datum(monthlyData)
    .attr("class", "line")
    .attr("d", line)
    .style("fill", "none")
    .style("stroke", "#1e3a8a")
    .style("stroke-width", 2.5);
  // X axis
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).tickSize(0))
    .call(g => {
      g.select(".domain").remove();
      g.selectAll("text")
        .style("font-size", "0.75rem")
        .style("font-weight", "500")
        .style("font-family", "Georgia, Times New Roman, serif")
        .attr("dy", "1.5em");
    });
  // Lollipop lines
  svg.selectAll("myline")
    .data(monthlyData)
    .join("line")
    .attr("x1", d => x(d.month) + x.bandwidth() / 2)
    .attr("x2", d => x(d.month) + x.bandwidth() / 2)
    .attr("y1", height)
    .attr("y2", d => y(d.count))
    .attr("stroke", "#b6b7d8")
    .attr("stroke-width", 1.5)
    .style("opacity", 0.6);
  // Circles
  svg.selectAll("mycircle")
    .data(monthlyData)
    .join("circle")
    .attr("cx", d => x(d.month) + x.bandwidth() / 2)
    .attr("cy", d => y(d.count))
    .attr("r", 6)
    .style("fill", "#1e3a8a")
    .style("stroke", "white")
    .style("stroke-width", 2)
    .on("mouseover", function(event, d) {
      // Show tooltip
      let tooltip = d3.select("body").selectAll(".lollipop-tooltip").data([null]);
      tooltip = tooltip.enter()
        .append("div")
        .attr("class", "lollipop-tooltip")
        .merge(tooltip)
        .style("position", "absolute")
        .style("background", "#fff")
        .style("border", "1px solid #ddd")
        .style("border-radius", "4px")
        .style("padding", "8px 14px")
        .style("font-family", "Georgia, Times New Roman, serif")
        .style("font-size", "0.95rem")
        .style("color", "#222")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.12)")
        .style("pointer-events", "none")
        .style("z-index", 1000)
        .style("visibility", "visible");
      tooltip.html(`<b>${d.month}</b><br>On-Time: <b>${d3.format(",")(d.count)}</b>`)
        .style("left", (event.pageX + 16) + "px")
        .style("top", (event.pageY - 32) + "px");
    })
    .on("mousemove", function(event, d) {
      d3.select(".lollipop-tooltip")
        .style("left", (event.pageX + 16) + "px")
        .style("top", (event.pageY - 32) + "px");
    })
    .on("mouseout", function() {
      d3.select(".lollipop-tooltip").remove();
    });
  // Values
  svg.selectAll("text.value")
    .data(monthlyData)
    .join("text")
    .attr("class", "value")
    .attr("x", d => x(d.month) + x.bandwidth() / 2)
    .attr("y", d => y(d.count) - 12)
    .attr("text-anchor", "middle")
    .style("fill", "#222")
    .style("font-size", "0.75rem")
    .style("font-weight", "500")
    .style("font-family", "Georgia, Times New Roman, serif")
    .text(d => d3.format(",")(d.count));
  // Percentage changes
  svg.selectAll("text.change")
    .data(monthlyData)
    .join("text")
    .attr("class", "change")
    .attr("x", d => x(d.month) + x.bandwidth() / 2)
    .attr("y", d => y(d.count) + 16)
    .attr("text-anchor", "middle")
    .style("fill", d => parseFloat(d.change) >= 0 ? "#15803d" : "#b91c1c")
    .style("font-size", "0.75rem")
    .style("font-weight", "500")
    .style("font-family", "Georgia, Times New Roman, serif")
    .text(d => d.change === "0.0" ? "" : `${parseFloat(d.change) >= 0 ? '▲' : '▼'} ${Math.abs(parseFloat(d.change))}%`);
  // Reliability score
  const totalServices = data.length;
  const onTimeServices = data.filter(d => d['Journey Status'] === 'On Time').length;
  const reliabilityScore = totalServices ? ((onTimeServices / totalServices) * 100).toFixed(0) : '-';
  document.getElementById('on-time-reliability-value').textContent = `${reliabilityScore}%`;
  // Highest/lowest for description
  const maxData = monthlyData.reduce((max, curr) => curr.count > max.count ? curr : max);
  const minData = monthlyData.reduce((min, curr) => curr.count < min.count ? curr : min);
  // Description
  d3.select("#lollipop-on-time").append("div")
    .style("margin-top", "5px")
    .style("padding-left", "50px")
    .style("max-width", "none")
    .style("font-family", "Georgia, Times New Roman, serif")
    .style("font-size", "1.05rem")
    .style("line-height", "1.6")
    .style("color", "#222")
    .html(`From January to April, the number of on-time services is relatively <span style="font-weight: bold;">consistent</span>, with slight fluctuations. <span style="font-weight: bold;">${maxData.month}</span> has the <span style="font-weight: bold;">highest</span> count of <span style="font-weight: bold;">${d3.format(",")(maxData.count)}</span> on-time services, while <span style="font-weight: bold;">${minData.month}</span> has the lowest with <span style="font-weight: bold;">${d3.format(",")(minData.count)}</span>.`);
}

// --- Update lollipop chart on filter change ---
function updateLollipopChart() {
  const filterBtns = document.querySelectorAll('#performanceFilterGroup .time-filter-btn');
  let filter = 'ALL';
  filterBtns.forEach(btn => { if (btn.classList.contains('active')) filter = btn.textContent.trim(); });
  if (!window.rawData) return;
  let filtered = window.rawData;
  if (filter !== 'ALL') {
    filtered = window.rawData.filter(row => {
      const hour = parseInt((row['Departure Time']||'').split(':')[0]);
      switch(filter) {
        case 'AM': return hour >= 0 && hour < 12;
        case 'PM': return hour >= 12 && hour < 24;
        case 'Peak': return (hour >= 6 && hour < 9) || (hour >= 16 && hour < 19);
        case 'Off-Peak': return (hour < 6 || hour >= 9) && (hour < 16 || hour >= 19);
        default: return true;
      }
    });
  }
  drawLollipopChart(filtered);
}
// --- Bind filter buttons ---
document.addEventListener('DOMContentLoaded', () => {
  const perfBtns = document.querySelectorAll('#performanceFilterGroup .time-filter-btn');
  perfBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      perfBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateServiceStatusCounts();
      updateHorizonChart();
      updateLollipopChart();
    });
  });
  // Initial render
  updateHorizonChart();
  updateLollipopChart();
});
// Also update on data load
if (typeof Papa !== 'undefined') {
  Papa.parse('data/railway.csv', {
    header: true,
    download: true,
    complete: function(results) {
      window.rawData = results.data;
      updateServiceStatusCounts();
      updateHorizonChart();
      updateLollipopChart();
      initParallelSets && initParallelSets();
    }
  });
}
// ... existing code ...
// Function to normalize delay reasons
function normalizeDelayReason(reason) {
    if (!reason) return 'Unknown';
    
    // Convert to lowercase for consistent comparison
    const lowerReason = reason.toLowerCase();
    
    // Normalize similar categories
    if (lowerReason.includes('signal')) return 'Signal Failure';
    if (lowerReason.includes('staff')) return 'Staffing';
    if (lowerReason.includes('weather')) return 'Weather';
    if (lowerReason.includes('technical')) return 'Technical Issue';
    if (lowerReason.includes('traffic')) return 'Traffic';
    
    return reason;
  }

// ... existing code ...
// Function to draw the disruption table
function drawDisruptionTable(data) {
  // Fixed date list (as in the reference image)
  const fixedDates = [
    '2024-01-02', '2024-01-18', '2024-01-23', '2024-01-28',
    '2024-02-14', '2024-02-22', '2024-02-26',
    '2024-03-02', '2024-03-05', '2024-03-07', '2024-03-15', '2024-03-27',
    '2024-04-22', '2024-04-30'
  ];

  // Build table data for each date
  const tableData = fixedDates.map(date => {
    const entries = data.filter(d => d['Date of Journey'] === date);
    const total = entries.length;
    const cancelled = entries.filter(d => d['Journey Status'] === 'Cancelled').length;
    const cancellationScore = total ? ((cancelled / total) * 100).toFixed(0) : '0';
    // Count reasons
    const reasons = {
      'Signal Failure': 0,
      'Staffing': 0,
      'Technical Issue': 0,
      'Traffic': 0,
      'Weather': 0
    };
    entries.forEach(entry => {
      const normReason = normalizeDelayReason(entry['Reason for Delay']);
      if (reasons.hasOwnProperty(normReason)) {
        reasons[normReason]++;
      }
    });
    // Convert to percent
    Object.keys(reasons).forEach(reason => {
      reasons[reason] = total ? ((reasons[reason] / total) * 100).toFixed(0) : '0';
    });
    return {
      date,
      cancellationScore,
      ...reasons
    };
  });

  // Optionally, add a total row (can be omitted if not needed)
  // const totalRow = { ... };

  // Render table
  const tbody = document.getElementById('disruption-data');
  if (!tbody) return;
  tbody.innerHTML = '';
  tableData.forEach(row => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #f3f4f6';
    // Date cell
    const dateCell = document.createElement('td');
    dateCell.style.padding = '12px 8px';
    dateCell.style.fontSize = '0.95rem';
    const [year, month, day] = row.date.split('-');
    dateCell.textContent = `${day}/${month}/${year}`;
    tr.appendChild(dateCell);
    // Cancellation Score
    const scoreCell = document.createElement('td');
    scoreCell.style.padding = '12px 8px';
    scoreCell.style.fontSize = '0.95rem';
    scoreCell.style.backgroundColor = `rgba(244, 199, 199, ${Math.min(1, row.cancellationScore / 15)})`;
    scoreCell.textContent = row.cancellationScore + '%';
    tr.appendChild(scoreCell);
    // Reason columns
    ['Signal Failure', 'Staffing', 'Technical Issue', 'Traffic', 'Weather'].forEach(reason => {
      const cell = document.createElement('td');
      cell.style.padding = '12px 8px';
      cell.style.fontSize = '0.95rem';
      cell.style.backgroundColor = `rgba(244, 199, 199, ${Math.min(1, row[reason] / 15)})`;
      cell.textContent = row[reason] + '%';
      tr.appendChild(cell);
    });
    tbody.appendChild(tr);
  });
}

// --- Update disruption table on filter change ---
function updateDisruptionTable() {
  const filterBtns = document.querySelectorAll('#performanceFilterGroup .time-filter-btn');
  let filter = 'ALL';
  filterBtns.forEach(btn => { if (btn.classList.contains('active')) filter = btn.textContent.trim(); });
  if (!window.rawData) return;
  let filtered = window.rawData;
  if (filter !== 'ALL') {
    filtered = window.rawData.filter(row => {
      const hour = parseInt((row['Departure Time']||'').split(':')[0]);
      switch(filter) {
        case 'AM': return hour >= 0 && hour < 12;
        case 'PM': return hour >= 12 && hour < 24;
        case 'Peak': return (hour >= 6 && hour < 9) || (hour >= 16 && hour < 19);
        case 'Off-Peak': return (hour < 6 || hour >= 9) && (hour < 16 || hour >= 19);
        default: return true;
      }
    });
  }
  drawDisruptionTable(filtered);
}

// --- Bind filter buttons ---
document.addEventListener('DOMContentLoaded', () => {
  const perfBtns = document.querySelectorAll('#performanceFilterGroup .time-filter-btn');
  perfBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      perfBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateServiceStatusCounts();
      updateHorizonChart();
      updateLollipopChart();
      updateDisruptionTable(); // Add this line
    });
  });
  // Initial render
  updateHorizonChart();
  updateLollipopChart();
  updateDisruptionTable(); // Add this line
});
// Also update on data load
if (typeof Papa !== 'undefined') {
  Papa.parse('data/railway.csv', {
    header: true,
    download: true,
    complete: function(results) {
      window.rawData = results.data;
      updateServiceStatusCounts();
      updateHorizonChart();
      updateLollipopChart();
      updateDisruptionTable(); // Add this line
      initParallelSets && initParallelSets();
    }
  });
}
// ... existing code ...

// ... existing code ...
// 绘制Radial Gauge和Sparkline
function drawReliabilityGauge(data) {
  // 过滤无效日期
  data = data.filter(d => {
    const date = new Date(d['Date of Journey']);
    return d['Date of Journey'] && !isNaN(date);
  });
  // 计算月度可靠性得分
  const monthlyScores = d3.group(data, d => {
    const date = new Date(d['Date of Journey']);
    return date.getMonth();
  });
  const reliabilityData = Array.from(monthlyScores).map(([month, services]) => {
    const onTime = services.filter(d => d['Journey Status'] === 'On Time').length;
    return {
      month: ['January', 'February', 'March', 'April'][month],
      score: (onTime / services.length) * 100
    };
  });
  // 获取最新的可靠性得分
  const currentScore = reliabilityData[reliabilityData.length - 1]?.score || 0;
  // 清除现有图表
  d3.select("#gauge-chart").html("");
  d3.select("#sparkline-chart").html("");
  // 设置gauge尺寸
  const gaugeWidth = document.getElementById("gauge-chart").clientWidth || 320;
  const gaugeHeight = document.getElementById("gauge-chart").clientHeight || 210;
  const radius = Math.min(gaugeWidth, gaugeHeight) / 2 * 0.7;
  // 创建SVG
  const gaugeSvg = d3.select("#gauge-chart")
    .append("svg")
    .attr("width", gaugeWidth)
    .attr("height", gaugeHeight)
    .append("g")
    .attr("transform", `translate(${gaugeWidth/2},${gaugeHeight/2 * 0.7})`);
  // 创建角度比例尺
  const scale = d3.scaleLinear()
    .domain([0, 100])
    .range([-Math.PI * 0.75, Math.PI * 0.75]);
  // 创建弧生成器
  const arc = d3.arc()
    .innerRadius(radius * 0.7)
    .outerRadius(radius)
    .startAngle(-Math.PI * 0.75)
    .endAngle(Math.PI * 0.75);
  // 创建背景弧
  gaugeSvg.append("path")
    .datum({endAngle: Math.PI * 0.75})
    .style("fill", "#e8eaf6")
    .attr("d", arc);
  // 创建前景弧
  const foregroundArc = d3.arc()
    .innerRadius(radius * 0.7)
    .outerRadius(radius)
    .startAngle(-Math.PI * 0.75)
    .endAngle(scale(currentScore));
  gaugeSvg.append("path")
    .style("fill", "#1e3a8a")
    .attr("d", foregroundArc)
    .style("cursor", "pointer")
    .on("mouseover", function(event) {
      let tooltip = d3.select("#gaugeTooltip");
      if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
          .attr("id", "gaugeTooltip")
          .attr("class", "radial-tooltip")
          .style("position", "absolute")
          .style("pointer-events", "none")
          .style("background", "rgba(255,255,255,0.98)")
          .style("border", "1px solid #e5e7eb")
          .style("border-radius", "4px")
          .style("padding", "10px 16px")
          .style("font-family", "PT Serif, serif")
          .style("font-size", "1rem")
          .style("color", "#222")
          .style("z-index", 1000);
      }
      tooltip.html(`<b>Current Reliability Score</b><br>On-Time Rate: <b>${currentScore.toFixed(2)}%</b>`)
        .style("left", (event.pageX + 14) + "px")
        .style("top", (event.pageY - 18) + "px")
        .style("opacity", 1);
      d3.select(this).style("opacity", 0.8);
    })
    .on("mousemove", function(event) {
      d3.select("#gaugeTooltip")
        .style("left", (event.pageX + 14) + "px")
        .style("top", (event.pageY - 18) + "px");
    })
    .on("mouseout", function() {
      d3.select("#gaugeTooltip").style("opacity", 0);
      d3.select(this).style("opacity", 1);
    });
  // 添加指针
  gaugeSvg.append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", radius * 0.8 * Math.cos(scale(currentScore)))
    .attr("y2", radius * 0.8 * Math.sin(scale(currentScore)))
    .style("stroke", "#1e3a8a")
    .style("stroke-width", 3);
  // 添加中心点
  gaugeSvg.append("circle")
    .attr("cx", 0)
    .attr("cy", 0)
    .attr("r", 5)
    .style("fill", "#1e3a8a");
  // 添加当前值文本
  gaugeSvg.append("text")
    .attr("x", 0)
    .attr("y", radius * 1.1)
    .attr("text-anchor", "middle")
    .style("font-size", "2.2rem")
    .style("font-weight", "bold")
    .style("font-family", "Georgia, Times New Roman, serif")
    .style("fill", "#374151")
    .text(`${currentScore.toFixed(2)}%`);
  // 绘制Sparkline
  const sparklineWidth = document.getElementById("sparkline-chart").clientWidth || 320;
  const sparklineHeight = document.getElementById("sparkline-chart").clientHeight || 80;
  const sparklineSvg = d3.select("#sparkline-chart")
    .append("svg")
    .attr("width", sparklineWidth)
    .attr("height", sparklineHeight)
    .append("g")
    .attr("transform", `translate(${sparklineWidth*0.1},${sparklineHeight*0.15})`);
  // 创建比例尺
  const x = d3.scalePoint()
    .domain(reliabilityData.map(d => d.month))
    .range([0, sparklineWidth * 0.8]);
  const y = d3.scaleLinear()
    .domain([
      d3.min(reliabilityData, d => d.score) * 0.995,
      d3.max(reliabilityData, d => d.score) * 1.005
    ])
    .range([sparklineHeight * 0.7, 0]);
  // 创建线生成器
  const line = d3.line()
    .x(d => x(d.month))
    .y(d => y(d.score))
    .curve(d3.curveCatmullRom.alpha(0.5));
  // 绘制线
  sparklineSvg.append("path")
    .datum(reliabilityData)
    .attr("fill", "none")
    .attr("stroke", "#1e3a8a")
    .attr("stroke-width", 2.5)
    .attr("d", line);
  // 添加点
  sparklineSvg.selectAll("circle")
    .data(reliabilityData)
    .join("circle")
    .attr("cx", d => x(d.month))
    .attr("cy", d => y(d.score))
    .attr("r", 4)
    .style("fill", "#1e3a8a")
    .style("cursor", "pointer")
    .on("mouseover", function(event, d) {
      let tooltip = d3.select("#sparklineTooltip");
      if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
          .attr("id", "sparklineTooltip")
          .attr("class", "radial-tooltip")
          .style("position", "absolute")
          .style("pointer-events", "none")
          .style("background", "rgba(255,255,255,0.98)")
          .style("border", "1px solid #e5e7eb")
          .style("border-radius", "4px")
          .style("padding", "10px 16px")
          .style("font-family", "PT Serif, serif")
          .style("font-size", "1rem")
          .style("color", "#222")
          .style("z-index", 1000);
      }
      const idx = reliabilityData.indexOf(d);
      const prevScore = idx > 0 ? reliabilityData[idx - 1].score : d.score;
      const change = ((d.score - prevScore) / prevScore * 100);
      const changeText = idx === 0 ? "" : `<br>Change: <b>${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}%</b>`;
      
      tooltip.html(`<b>${d.month}</b><br>Reliability: <b>${d.score.toFixed(2)}%</b>${changeText}`)
        .style("left", (event.pageX + 14) + "px")
        .style("top", (event.pageY - 18) + "px")
        .style("opacity", 1);
      d3.select(this)
        .attr("r", 6)
        .style("fill", "#ffe69c");
    })
    .on("mousemove", function(event) {
      d3.select("#sparklineTooltip")
        .style("left", (event.pageX + 14) + "px")
        .style("top", (event.pageY - 18) + "px");
    })
    .on("mouseout", function() {
      d3.select("#sparklineTooltip").style("opacity", 0);
      d3.select(this)
        .attr("r", 4)
        .style("fill", "#1e3a8a");
    });
  // 添加百分比标签
  sparklineSvg.selectAll("text.value")
    .data(reliabilityData)
    .join("text")
    .attr("class", "value")
    .attr("x", d => x(d.month))
    .attr("y", d => y(d.score) - 12)
    .attr("text-anchor", "middle")
    .style("font-size", "0.8rem")
    .style("font-weight", "500")
    .style("font-family", "Georgia, Times New Roman, serif")
    .style("fill", "#374151")
    .text(d => `${d.score.toFixed(2)}%`);
  // 添加变化百分比标签
  sparklineSvg.selectAll("text.change")
    .data(reliabilityData.slice(1))
    .join("text")
    .attr("class", "change")
    .attr("x", d => x(d.month))
    .attr("y", d => y(d.score) - 28)
    .attr("text-anchor", "middle")
    .style("font-size", "0.75rem")
    .style("font-weight", "500")
    .style("font-family", "Georgia, Times New Roman, serif")
    .style("fill", (d, i) => {
      const prevScore = reliabilityData[i].score;
      const change = ((d.score - prevScore) / prevScore * 100);
      return change >= 0 ? "#15803d" : "#b91c1c";
    })
    .text((d, i) => {
      const prevScore = reliabilityData[i].score;
      const change = ((d.score - prevScore) / prevScore * 100);
      return `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}%`;
    });
  // 添加月份标签
  sparklineSvg.selectAll("text.month")
    .data(reliabilityData)
    .join("text")
    .attr("class", "month")
    .attr("x", d => x(d.month))
    .attr("y", sparklineHeight * 0.75)
    .attr("text-anchor", "middle")
    .style("font-size", "0.95rem")
    .style("font-family", "Georgia, Times New Roman, serif")
    .style("font-weight", "bold")
    .text(d => d.month);
}

// --- Update reliability gauge on filter change ---
function updateReliabilityGauge() {
  const filterBtns = document.querySelectorAll('#performanceFilterGroup .time-filter-btn');
  let filter = 'ALL';
  filterBtns.forEach(btn => { if (btn.classList.contains('active')) filter = btn.textContent.trim(); });
  if (!window.rawData) return;
  let filtered = window.rawData;
  if (filter !== 'ALL') {
    filtered = window.rawData.filter(row => {
      const hour = parseInt((row['Departure Time']||'').split(':')[0]);
      switch(filter) {
        case 'AM': return hour >= 0 && hour < 12;
        case 'PM': return hour >= 12 && hour < 24;
        case 'Peak': return (hour >= 6 && hour < 9) || (hour >= 16 && hour < 19);
        case 'Off-Peak': return (hour < 6 || hour >= 9) && (hour < 16 || hour >= 19);
        default: return true;
      }
    });
  }
  drawReliabilityGauge(filtered);
}

// --- Bind filter buttons ---
document.addEventListener('DOMContentLoaded', () => {
  const perfBtns = document.querySelectorAll('#performanceFilterGroup .time-filter-btn');
  perfBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      perfBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateServiceStatusCounts();
      updateHorizonChart();
      updateLollipopChart();
      updateDisruptionTable();
      updateReliabilityGauge(); // Add this line
    });
  });
  // Initial render
  updateHorizonChart();
  updateLollipopChart();
  updateDisruptionTable();
  updateReliabilityGauge(); // Add this line
});
// Also update on data load
if (typeof Papa !== 'undefined') {
  Papa.parse('data/railway.csv', {
    header: true,
    download: true,
    complete: function(results) {
      window.rawData = results.data;
      updateServiceStatusCounts();
      updateHorizonChart();
      updateLollipopChart();
      updateDisruptionTable();
      updateReliabilityGauge(); // Add this line
      initParallelSets && initParallelSets();
    }
  });
}

// Function to draw the tornado chart for leading causes
function drawLeadingCausesTornado(data) {
  d3.select("#leading-causes-tornado").html("");
  const width = document.getElementById("leading-causes-tornado").clientWidth;
  const height = document.getElementById("leading-causes-tornado").clientHeight;
  const margin = { top: 20, right: 120, bottom: 20, left: 120 };
  const colors = ['#b6b7d8', '#8e8fc7', '#6668b5', '#1e3a8a'];
  const svg = d3.select("#leading-causes-tornado")
    .append("svg")
    .attr("width", width)
    .attr("height", height);
  const cancelledJourneys = data.filter(d => d['Journey Status'] === 'Cancelled');
  const groupedData = d3.group(cancelledJourneys, d => normalizeDelayReason(d['Reason for Delay']));
  const processedData = Array.from(groupedData, ([reason, journeys]) => ({
    reason: reason,
    passengers: journeys.length,
    refundAmount: journeys.reduce((sum, j) => sum + (parseFloat(j.Price) || 0), 0)
  })).sort((a, b) => b.passengers - a.passengers);
  const maxPassengers = d3.max(processedData, d => d.passengers) || 1;
  const maxRefund = d3.max(processedData, d => d.refundAmount) || 1;
  const y = d3.scaleBand()
    .domain(processedData.map(d => d.reason))
    .range([margin.top, height - margin.bottom])
    .padding(0.2);
  const xLeft = d3.scaleLinear()
    .domain([maxPassengers, 0])
    .range([margin.left, width/2]);
  const xRight = d3.scaleLinear()
    .domain([0, maxRefund])
    .range([width/2, width - margin.right]);
  svg.append("line")
    .attr("x1", width/2)
    .attr("x2", width/2)
    .attr("y1", margin.top)
    .attr("y2", height - margin.bottom)
    .attr("stroke", "#ccc")
    .attr("stroke-width", 1);
  svg.selectAll(".bar-passengers")
    .data(processedData)
    .join("rect")
    .attr("class", "bar-passengers")
    .attr("x", d => xLeft(d.passengers))
    .attr("y", d => y(d.reason))
    .attr("width", d => width/2 - xLeft(d.passengers))
    .attr("height", y.bandwidth())
    .attr("fill", colors[2])
    .attr("opacity", 0.8)
    .style("cursor", "pointer")
    .on("mouseover", function(event, d) {
      // Show tooltip
      let tooltip = d3.select("#tornadoTooltip");
      if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
          .attr("id", "tornadoTooltip")
          .attr("class", "radial-tooltip")
          .style("position", "absolute")
          .style("pointer-events", "none")
          .style("background", "rgba(255,255,255,0.98)")
          .style("border", "1px solid #e5e7eb")
          .style("border-radius", "4px")
          .style("padding", "10px 16px")
          .style("font-family", "PT Serif, serif")
          .style("font-size", "1rem")
          .style("color", "#222")
          .style("z-index", 1000);
      }
      tooltip.html(`<b>${d.reason}</b><br>Affected Passengers: <b>${d.passengers.toLocaleString()}</b>`)
        .style("left", (event.pageX + 14) + "px")
        .style("top", (event.pageY - 18) + "px")
        .style("opacity", 1);
      d3.select(this).attr("opacity", 1);
    })
    .on("mousemove", function(event) {
      d3.select("#tornadoTooltip")
        .style("left", (event.pageX + 14) + "px")
        .style("top", (event.pageY - 18) + "px");
    })
    .on("mouseout", function() {
      d3.select("#tornadoTooltip").style("opacity", 0);
      d3.select(this).attr("opacity", 0.8);
    });

  svg.selectAll(".bar-refund")
    .data(processedData)
    .join("rect")
    .attr("class", "bar-refund")
    .attr("x", width/2)
    .attr("y", d => y(d.reason))
    .attr("width", d => xRight(d.refundAmount) - width/2)
    .attr("height", y.bandwidth())
    .attr("fill", colors[3])
    .attr("opacity", 0.8)
    .style("cursor", "pointer")
    .on("mouseover", function(event, d) {
      // Show tooltip
      let tooltip = d3.select("#tornadoTooltip");
      if (tooltip.empty()) {
        tooltip = d3.select("body").append("div")
          .attr("id", "tornadoTooltip")
          .attr("class", "radial-tooltip")
          .style("position", "absolute")
          .style("pointer-events", "none")
          .style("background", "rgba(255,255,255,0.98)")
          .style("border", "1px solid #e5e7eb")
          .style("border-radius", "4px")
          .style("padding", "10px 16px")
          .style("font-family", "PT Serif, serif")
          .style("font-size", "1rem")
          .style("color", "#222")
          .style("z-index", 1000);
      }
      tooltip.html(`<b>${d.reason}</b><br>Total Refund: <b>£${d.refundAmount.toLocaleString()}</b>`)
        .style("left", (event.pageX + 14) + "px")
        .style("top", (event.pageY - 18) + "px")
        .style("opacity", 1);
      d3.select(this).attr("opacity", 1);
    })
    .on("mousemove", function(event) {
      d3.select("#tornadoTooltip")
        .style("left", (event.pageX + 14) + "px")
        .style("top", (event.pageY - 18) + "px");
    })
    .on("mouseout", function() {
      d3.select("#tornadoTooltip").style("opacity", 0);
      d3.select(this).attr("opacity", 0.8);
    });

  svg.selectAll(".label-passengers")
    .data(processedData)
    .join("text")
    .attr("class", "label-passengers")
    .attr("x", d => xLeft(d.passengers) - 5)
    .attr("y", d => y(d.reason) + y.bandwidth() / 2)
    .attr("text-anchor", "end")
    .attr("alignment-baseline", "middle")
    .attr("font-family", "Georgia, Times New Roman, serif")
    .attr("font-size", "0.8rem")
    .text(d => d.passengers.toLocaleString());
  svg.selectAll(".label-refund")
    .data(processedData)
    .join("text")
    .attr("class", "label-refund")
    .attr("x", d => xRight(d.refundAmount) + 5)
    .attr("y", d => y(d.reason) + y.bandwidth() / 2)
    .attr("text-anchor", "start")
    .attr("alignment-baseline", "middle")
    .attr("font-family", "Georgia, Times New Roman, serif")
    .attr("font-size", "0.8rem")
    .text(d => `£${d.refundAmount.toLocaleString()}`);
  svg.selectAll(".label-reason")
    .data(processedData)
    .join("text")
    .attr("class", "label-reason")
    .attr("x", width/2)
    .attr("y", d => y(d.reason) + y.bandwidth() / 2)
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .attr("font-family", "Georgia, Times New Roman, serif")
    .attr("font-size", "0.9rem")
    .attr("font-weight", "bold")
    .attr("fill", "#fff")
    .text(d => d.reason);
  svg.append("text")
    .attr("x", margin.left)
    .attr("y", margin.top - 5)
    .attr("text-anchor", "middle")
    .attr("font-family", "Georgia, Times New Roman, serif")
    .attr("font-size", "0.9rem")
    .attr("font-weight", "bold")
    .text("Affected Passengers");
  svg.append("text")
    .attr("x", width - margin.right)
    .attr("y", margin.top - 5)
    .attr("text-anchor", "middle")
    .attr("font-family", "Georgia, Times New Roman, serif")
    .attr("font-size", "0.9rem")
    .attr("font-weight", "bold")
    .text("Total Refund Amount");
}

function updateLeadingCausesTornado() {
  const filtered = getPerformanceFilteredData();
  drawLeadingCausesTornado(filtered);
}

// --- 绑定 performance filter 按钮和初始渲染 ---
document.addEventListener('DOMContentLoaded', () => {
  const perfBtns = document.querySelectorAll('#performanceFilterGroup .time-filter-btn');
  perfBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      updateLeadingCausesTornado();
    });
  });
  updateLeadingCausesTornado();
});

// --- Papa 解析 railway.csv 后也要刷新 ---
if (typeof Papa !== 'undefined') {
  Papa.parse('data/railway.csv', {
    header: true,
    download: true,
    complete: function(results) {
      window.rawData = results.data;
      updateLeadingCausesTornado();
    }
  });
}// ... existing code ...
