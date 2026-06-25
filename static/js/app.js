// Update sidebar panel contents and charts with aggregated data for a NAFO Zone (Map Selection)
function selectZone(zoneCode) {
    if (typeof sealsData === 'undefined' || sealsData.length === 0) return;

    const zoneSeals = sealsData.filter(s => s.nafo_zone === zoneCode);
    if (zoneSeals.length === 0) return;

    const titleEl = document.getElementById('side-title');
    if (titleEl) titleEl.innerText = `${zoneCode} Zone Profile`;
    
    const totalCount = zoneSeals.length;
    
    let males = 0, females = 0, unknowns = 0;
    let ageSum = 0;
    let ageCount = 0;
    let otolithSum = 0;
    let otolithCount = 0;
    
    const aggregatedPrey = {};
    let totalPreyCount = 0;
    
    zoneSeals.forEach(s => {
        if (s.gender === 'M') males++;
        else if (s.gender === 'F') females++;
        else unknowns++;
        
        if (s.age_num !== null && s.age_num !== undefined) {
            ageSum += s.age_num;
            ageCount++;
        }

        if (s.otolith !== null && s.otolith !== undefined) {
            otolithSum += s.otolith;
            otolithCount++;
        }

        if (s.prey_contents) {
            for (const [prey, count] of Object.entries(s.prey_contents)) {
                aggregatedPrey[prey] = (aggregatedPrey[prey] || 0) + count;
                totalPreyCount += count;
            }
        }
    });
    
    const avgAge = ageCount > 0 ? (ageSum / ageCount).toFixed(1) : 'N/A';
    
    const popEl = document.getElementById('side-pop');
    if (popEl) popEl.innerText = `${totalCount} Seals`;

    const ageEl = document.getElementById('side-age');
    if (ageEl) ageEl.innerText = `${avgAge} yrs (Average)`;

    updateDemographicsChart(males, females, unknowns);

    const ageData = getAgeDistribution(zoneSeals);
    updateAgeChart(ageData.labels, ageData.counts);

    updateStomachChart(aggregatedPrey, totalPreyCount);
}

// Update bottom snapshot details and individual charts for an individual seal (Index Selection)
function selectSeal(seal) {
    if (!seal) return;

    const detailIdEl = document.getElementById('detail-id');
    if (detailIdEl) detailIdEl.innerText = seal.id;
    
    const detailGenderEl = document.getElementById('detail-gender');
    if (detailGenderEl) {
        const genderDisplay = seal.gender === 'M' ? 'Male' : seal.gender === 'F' ? 'Female' : 'Unknown';
        detailGenderEl.innerText = genderDisplay;
    }

    const detailAgeEl = document.getElementById('detail-age');
    if (detailAgeEl) detailAgeEl.innerText = seal.age;

    const detailLocEl = document.getElementById('detail-location');
    if (detailLocEl) detailLocEl.innerText = seal.area || seal.nafo_zone || '-';

    const detailMealEl = document.getElementById('detail-meal');
    if (detailMealEl) detailMealEl.innerText = seal.meal;

    const preyVisual = document.getElementById('prey-visual');
    if (preyVisual && seal.otolith) {
        const scale = Math.min(Math.max(seal.otolith * 0.4, 0.5), 3.0);
        preyVisual.style.transform = `scale(${scale})`;
    }

    updateDetailStomachChart(seal.prey_contents || {}, seal.total_prey_items || 0);
}

// Start application
function init() {
    renderInterface();
    populateFilters();

    // Auto-select initial elements on load once layout has completely stabilized
    if (typeof sealsData !== 'undefined' && Array.isArray(sealsData) && sealsData.length > 0) {
        setTimeout(() => {
            try {
                // Determine first available NAFO zone dynamically
                const zones = [...new Set(sealsData.map(s => s.nafo_zone).filter(Boolean))].sort();
                if (zones.length > 0) {
                    selectZone(zones[0]);
                }
                
                // Select first individual seal profile 
                selectSeal(sealsData[0]);
            } catch (err) {
                console.warn("Auto-selection could not render fully on start:", err);
            }
        }, 150); // Gives ample layout calculation headroom
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}