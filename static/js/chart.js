// Draw gender distribution as a Pie Chart
function updateDemographicsChart(males, females, unknowns) {
    const ctx = document.getElementById('ratioChart');
    if (!ctx) return;
    if (typeof Chart === 'undefined') return;

    if (ratioChartInstance) {
        // Update data values and trigger the morph transition
        ratioChartInstance.data.datasets[0].data = [males, females, unknowns];
        ratioChartInstance.update(); 
    } else {
        // First-time creation
        ratioChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Male', 'Female', 'Unknown'],
                datasets: [{
                    label: 'Seal Count',
                    data: [males, females, unknowns],
                    backgroundColor: [
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(255, 99, 132, 0.6)',
                        'rgba(153, 102, 255, 0.6)'
                    ],
                    borderColor: [
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 99, 132, 1)',
                        'rgba(153, 102, 255, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 10,
                            font: { size: 10 }
                        }
                    }
                }
            }
        });
    }
}

// Draw age distribution as a Bar Chart
function updateAgeChart(labels, counts) {
    const ctx = document.getElementById('ageChart');
    if (!ctx) return;
    if (typeof Chart === 'undefined') return;

    if (ageChartInstance) {
        // Update both labels and counts, then transition
        ageChartInstance.data.labels = labels;
        ageChartInstance.data.datasets[0].data = counts;
        ageChartInstance.update(); 
    } else {
        // First-time creation
        ageChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Seals Count',
                    data: counts,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0,
                            font: { size: 9 }
                        }
                    },
                    x: {
                        ticks: {
                            font: { size: 9 }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
}

// Update stomach content donut chart with changes to legend 
function updateStomachChart(preyContents, totalPreyItems) {
    const ctx = document.getElementById('stomachChart');
    const noteEl = document.getElementById('stomach-note');
    if (!ctx) return;
    if (typeof Chart === 'undefined') return;

    const preyItemsArray = Object.entries(preyContents).map(([label, value]) => ({ label, value }));
    preyItemsArray.sort((a, b) => b.value - a.value);

    const labels = preyItemsArray.map(item => item.label);
    const data = preyItemsArray.map(item => item.value);

    const backgroundColors = labels.map((label, idx) => {
        if (label === 'Empty') return 'rgba(180, 180, 180, 0.5)';
        const colors = [
            'rgba(46, 204, 113, 0.6)',
            'rgba(52, 152, 219, 0.6)',
            'rgba(155, 89, 182, 0.6)',
            'rgba(241, 196, 15, 0.6)',
            'rgba(230, 126, 34, 0.6)',
            'rgba(231, 76, 60, 0.6)'
        ];
        return colors[idx % colors.length];
    });

    const borderColors = labels.map((label, idx) => {
        if (label === 'Empty') return 'rgba(180, 180, 180, 1)';
        const colors = [
            'rgba(46, 204, 113, 1)',
            'rgba(52, 152, 219, 1)',
            'rgba(155, 89, 182, 1)',
            'rgba(241, 196, 15, 1)',
            'rgba(230, 126, 34, 1)',
            'rgba(231, 76, 60, 1)'
        ];
        return colors[idx % colors.length];
    });

    if (stomachChartInstance) {
        // Update all configuration targets dynamically
        stomachChartInstance.data.labels = labels;
        stomachChartInstance.data.datasets[0].data = data;
        stomachChartInstance.data.datasets[0].backgroundColor = backgroundColors;
        stomachChartInstance.data.datasets[0].borderColor = borderColors;
        stomachChartInstance.update(); 
    } else {
        // First-time creation
        stomachChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    let legendContainer = document.getElementById('stomach-legend-container');
    if (!legendContainer) {
        legendContainer = document.createElement('div');
        legendContainer.id = 'stomach-legend-container';
        legendContainer.setAttribute('style', 'max-height: 180px; overflow-y: auto; margin-top: 12px; padding: 8px; font-size: 11px; border: 1px dashed #ccc; border-radius: 4px; background: #fafafa;');
        const canvasWrapper = ctx.parentElement;
        canvasWrapper.parentNode.insertBefore(legendContainer, canvasWrapper.nextSibling);
    }

    if (legendContainer) {
        legendContainer.innerHTML = '';
        const legendList = document.createElement('div');
        legendList.style.display = 'flex';
        legendList.style.flexWrap = 'wrap';
        legendList.style.gap = '6px';
        legendList.style.justifyContent = 'flex-start';
        
        labels.forEach((label, idx) => {
            const legendItem = document.createElement('div');
            legendItem.style.display = 'flex';
            legendItem.style.alignItems = 'center';
            legendItem.style.fontSize = '11px';
            legendItem.style.cursor = 'pointer';
            legendItem.style.userSelect = 'none';
            legendItem.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
            legendItem.style.padding = '3px 8px';
            legendItem.style.borderRadius = '12px';
            legendItem.style.border = `1px solid ${borderColors[idx]}`;
            legendItem.style.transition = 'all 0.2s ease';
            
            const colorBox = document.createElement('span');
            colorBox.style.display = 'inline-block';
            colorBox.style.width = '8px';
            colorBox.style.height = '8px';
            colorBox.style.borderRadius = '50%';
            colorBox.style.backgroundColor = backgroundColors[idx];
            colorBox.style.marginRight = '6px';
            colorBox.style.flexShrink = '0';
            
            const labelText = document.createElement('span');
            labelText.innerText = `${label} (${data[idx]})`;
            labelText.style.color = '#333';
            labelText.style.fontWeight = '500';
            
            legendItem.appendChild(colorBox);
            legendItem.appendChild(labelText);
            
            legendItem.addEventListener('mouseover', () => {
                legendItem.style.backgroundColor = 'rgba(0, 0, 0, 0.08)';
                legendItem.style.transform = 'translateY(-1px)';
            });
            legendItem.addEventListener('mouseout', () => {
                legendItem.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
                legendItem.style.transform = 'translateY(0)';
            });
            
            legendItem.addEventListener('click', () => {
                const isVisible = stomachChartInstance.getDataVisibility(idx);
                stomachChartInstance.toggleDataVisibility(idx);
                stomachChartInstance.update();
                
                if (isVisible) {
                    legendItem.style.opacity = '0.35';
                    legendItem.style.textDecoration = 'line-through';
                    legendItem.style.backgroundColor = 'rgba(0, 0, 0, 0.01)';
                } else {
                    legendItem.style.opacity = '1';
                    legendItem.style.textDecoration = 'none';
                    legendItem.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
                }
            });
            
            legendList.appendChild(legendItem);
        });
        
        legendContainer.appendChild(legendList);
    }

    if (noteEl) {
        noteEl.innerHTML = `<strong>Note:</strong> ${totalPreyItems} data points analyzed. <br> Click on a prey to remove it from the chart.`;
    }
}

// Update individual stomach content donut chart with dynamic HTML legend inside the card
function updateDetailStomachChart(preyContents, totalPreyItems) {
    const ctx = document.getElementById('detailStomachChart');
    const noteEl = document.getElementById('detail-stomach-note');
    if (!ctx) return;
    if (typeof Chart === 'undefined') return;

    const preyItemsArray = Object.entries(preyContents).map(([label, value]) => ({ label, value }));
    preyItemsArray.sort((a, b) => b.value - a.value);

    const labels = preyItemsArray.map(item => item.label);
    const data = preyItemsArray.map(item => item.value);

    const backgroundColors = labels.map((label, idx) => {
        if (label === 'Empty') return 'rgba(180, 180, 180, 0.5)';
        const colors = [
            'rgba(46, 204, 113, 0.6)',
            'rgba(52, 152, 219, 0.6)',
            'rgba(155, 89, 182, 0.6)',
            'rgba(241, 196, 15, 0.6)',
            'rgba(230, 126, 34, 0.6)',
            'rgba(231, 76, 60, 0.6)'
        ];
        return colors[idx % colors.length];
    });

    const borderColors = labels.map((label, idx) => {
        if (label === 'Empty') return 'rgba(180, 180, 180, 1)';
        const colors = [
            'rgba(46, 204, 113, 1)',
            'rgba(52, 152, 219, 1)',
            'rgba(155, 89, 182, 1)',
            'rgba(241, 196, 15, 1)',
            'rgba(230, 126, 34, 1)',
            'rgba(231, 76, 60, 1)'
        ];
        return colors[idx % colors.length];
    });

    if (detailStomachChartInstance) {
        // Update all configuration targets dynamically
        detailStomachChartInstance.data.labels = labels;
        detailStomachChartInstance.data.datasets[0].data = data;
        detailStomachChartInstance.data.datasets[0].backgroundColor = backgroundColors;
        detailStomachChartInstance.data.datasets[0].borderColor = borderColors;
        detailStomachChartInstance.update(); 
    } else {
        // First-time creation
        detailStomachChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    let legendContainer = document.getElementById('detail-stomach-legend-container');
    if (!legendContainer) {
        legendContainer = document.createElement('div');
        legendContainer.id = 'detail-stomach-legend-container';
        legendContainer.setAttribute('style', 'max-height: 100px; overflow-y: auto; margin-top: 8px; padding: 6px; font-size: 10px; border: 1px dashed #ccc; border-radius: 4px; background: #fafafa;');
        const canvasWrapper = ctx.parentElement;
        canvasWrapper.parentNode.insertBefore(legendContainer, canvasWrapper.nextSibling);
    }

    if (legendContainer) {
        legendContainer.innerHTML = '';
        const legendList = document.createElement('div');
        legendList.style.display = 'flex';
        legendList.style.flexWrap = 'wrap';
        legendList.style.gap = '4px';
        legendList.style.justifyContent = 'flex-start';
        
        labels.forEach((label, idx) => {
            const legendItem = document.createElement('div');
            legendItem.style.display = 'flex';
            legendItem.style.alignItems = 'center';
            legendItem.style.fontSize = '10px';
            legendItem.style.cursor = 'pointer';
            legendItem.style.userSelect = 'none';
            legendItem.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
            legendItem.style.padding = '2px 6px';
            legendItem.style.borderRadius = '10px';
            legendItem.style.border = `1px solid ${borderColors[idx]}`;
            legendItem.style.transition = 'all 0.2s ease';
            
            const colorBox = document.createElement('span');
            colorBox.style.display = 'inline-block';
            colorBox.style.width = '6px';
            colorBox.style.height = '6px';
            colorBox.style.borderRadius = '50%';
            colorBox.style.backgroundColor = backgroundColors[idx];
            colorBox.style.marginRight = '4px';
            colorBox.style.flexShrink = '0';
            
            const labelText = document.createElement('span');
            labelText.innerText = `${label} (${data[idx]})`;
            labelText.style.color = '#333';
            labelText.style.fontWeight = '500';
            
            legendItem.appendChild(colorBox);
            legendItem.appendChild(labelText);
            
            legendItem.addEventListener('mouseover', () => {
                legendItem.style.backgroundColor = 'rgba(0, 0, 0, 0.08)';
            });
            legendItem.addEventListener('mouseout', () => {
                legendItem.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
            });
            
            legendItem.addEventListener('click', () => {
                const isVisible = detailStomachChartInstance.getDataVisibility(idx);
                detailStomachChartInstance.toggleDataVisibility(idx);
                detailStomachChartInstance.update();
                
                if (isVisible) {
                    legendItem.style.opacity = '0.35';
                    legendItem.style.textDecoration = 'line-through';
                    legendItem.style.backgroundColor = 'rgba(0, 0, 0, 0.01)';
                } else {
                    legendItem.style.opacity = '1';
                    legendItem.style.textDecoration = 'none';
                    legendItem.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
                }
            });
            
            legendList.appendChild(legendItem);
        });
        
        legendContainer.appendChild(legendList);
    }

    if (noteEl) {
        noteEl.innerHTML = `<strong>Note:</strong> ${totalPreyItems} items recorded. \nClick on a prey to remove it from the chart.`;
    }
}