document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dateSelect = document.getElementById('date-select');
    const initialInventoryInput = document.getElementById('initial-inventory');
    const newDefectsInput = document.getElementById('new-defects');
    const reworkedInput = document.getElementById('reworked');
    const saveBtn = document.getElementById('save-btn');
    const saveImageBtn = document.getElementById('save-image-btn');
    const containerToCapture = document.querySelector('.container');

    const statNewDefects = document.getElementById('stat-new-defects');
    const statReworked = document.getElementById('stat-reworked');
    const statTodayInventory = document.getElementById('stat-today-inventory');

    const chartCanvas = document.getElementById('inventory-chart');

    // Data structure
    let dailyData = {};
    const dates = [];
    let lastModifiedDateIndex = -1;

    // Initialize data for the period
    function initializeData() {
        const startDate = new Date('2026-01-18');
        const endDate = new Date('2026-01-31');
        
        for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateString = d.toISOString().split('T')[0];
            dates.push(dateString);
            dailyData[dateString] = {
                initialInventory: 0,
                newDefects: 0,
                reworked: 0,
                todayInventory: 0
            };
        }

        // Populate date selector
        dates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            option.textContent = date;
            dateSelect.appendChild(option);
        });
        
        // Set initial state to the first date
        dateSelect.value = dates[0];
        loadDataForDate(dates[0]);
    }

    function getPreviousDate(dateString) {
        const date = new Date(dateString);
        date.setDate(date.getDate() - 1);
        return date.toISOString().split('T')[0];
    }

    function loadDataForDate(date) {
        const data = dailyData[date];
        const previousDate = getPreviousDate(date);
        
        const prevInventory = dailyData[previousDate] ? dailyData[previousDate].todayInventory : 0;
        data.initialInventory = prevInventory;

        initialInventoryInput.value = data.initialInventory;
        newDefectsInput.value = data.newDefects || '';
        reworkedInput.value = data.reworked || '';

        updateStats(date);
        newDefectsInput.focus();
    }

    function saveData() {
        const selectedDate = dateSelect.value;
        const selectedIndex = dates.indexOf(selectedDate);
        const newDefects = parseInt(newDefectsInput.value) || 0;
        const reworked = parseInt(reworkedInput.value) || 0;

        if (newDefects > 0 || reworked > 0) {
            lastModifiedDateIndex = Math.max(lastModifiedDateIndex, selectedIndex);
        }

        const data = dailyData[selectedDate];
        data.newDefects = newDefects;
        data.reworked = reworked;
        data.todayInventory = data.initialInventory + newDefects - reworked;

        updateSubsequentDays(selectedDate);
        
        updateStats(selectedDate);
        updateChart();
    }

    function updateSubsequentDays(startDate) {
        const startIndex = dates.indexOf(startDate);
        for (let i = startIndex + 1; i < dates.length; i++) {
            const currentDate = dates[i];
            const previousDate = dates[i-1];
            dailyData[currentDate].initialInventory = dailyData[previousDate].todayInventory;
            dailyData[currentDate].todayInventory = dailyData[currentDate].initialInventory + dailyData[currentDate].newDefects - dailyData[currentDate].reworked;
        }
        loadDataForDate(dateSelect.value);
    }


    function updateStats(date) {
        const data = dailyData[date];
        statNewDefects.textContent = data.newDefects;
        statReworked.textContent = data.reworked;
        statTodayInventory.textContent = data.todayInventory;
    }

    // Chart.js instance
    let inventoryChart;
    function updateChart() {
        const displayIndex = lastModifiedDateIndex === -1 ? dates.length -1 : lastModifiedDateIndex;
        
        const labels = dates.slice(0, displayIndex + 1);
        const inventoryData = labels.map(date => dailyData[date].todayInventory);
        const newDefectsData = labels.map(date => dailyData[date].newDefects);
        const reworkedData = labels.map(date => dailyData[date].reworked);

        if (inventoryChart) {
            inventoryChart.destroy();
        }

        inventoryChart = new Chart(chartCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        type: 'line',
                        label: '일일 재고',
                        data: inventoryData,
                        borderColor: '#3f51b5',
                        backgroundColor: 'rgba(63, 81, 181, 0.1)',
                        fill: true,
                        tension: 0.1,
                        yAxisID: 'y'
                    },
                    {
                        type: 'bar',
                        label: '신규 불량',
                        data: newDefectsData,
                        backgroundColor: 'rgba(244, 67, 54, 0.7)',
                        yAxisID: 'y'
                    },
                    {
                        type: 'bar',
                        label: '작업량',
                        data: reworkedData,
                        backgroundColor: 'rgba(76, 175, 80, 0.7)',
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: '기간별 재고, 신규 불량 및 작업량 추이'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        position: 'left'
                    }
                }
            }
        });
    }

    function captureAndSave() {
        html2canvas(containerToCapture, {
            onclone: (document) => {
                // Ensure the canvas chart is redrawn in the cloned document for capture
                // This can sometimes be necessary if the chart is rendered oddly
            }
        }).then(canvas => {
            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = image;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            link.download = `rework-summary-${timestamp}.png`;
            link.click();
        });
    }

    // Event Listeners
    dateSelect.addEventListener('change', (e) => loadDataForDate(e.target.value));
    saveBtn.addEventListener('click', saveData);
    saveImageBtn.addEventListener('click', captureAndSave);

    // Initial setup
    initializeData();
    updateChart();
});
