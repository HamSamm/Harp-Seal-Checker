// Global State Variables
let ratioChartInstance = null;
let ageChartInstance = null;
let stomachChartInstance = null;
let detailStomachChartInstance = null; // Individual card chart

// Callback for the Folium map within the iframe (traditional fallback)
window.selectSealFromMap = function(zoneCode) {
    selectZone(zoneCode);
};

window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'selectZone') {
        selectZone(event.data.zone);
    }
});

function getAgeDistribution(sealsList) {
    let maxAge = 0;
    sealsData.forEach(s => {
        if (s.age_num !== null && s.age_num !== undefined && s.age_num > maxAge) {
            maxAge = s.age_num;
        }
    });
    if (maxAge === 0) maxAge = 21;

    const bins = [];
    for (let i = 0; i <= maxAge; i += 3) {
        bins.push({
            label: `${i}-${i+2}`,
            min: i,
            max: i+2,
            count: 0
        });
    }
    const unknownBin = {
        label: 'Unknown',
        count: 0
    };

    sealsList.forEach(s => {
        const age = s.age_num;
        if (age === null || age === undefined) {
            unknownBin.count++;
        } else {
            let placed = false;
            for (let b of bins) {
                if (age >= b.min && age <= b.max) {
                    b.count++;
                    placed = true;
                    break;
                }
            }
            if (!placed && bins.length > 0) {
                bins[bins.length - 1].count++;
            }
        }
    });

    const labels = bins.map(b => b.label).concat([unknownBin.label]);
    const counts = bins.map(b => b.count).concat([unknownBin.count]);

    return { labels, counts };
}