document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dateSelect = document.getElementById('date-select');
    const initialInventoryInput = document.getElementById('initial-inventory');
    const newDefectsInput = document.getElementById('new-defects');
    const reworkedInput = document.getElementById('reworked');
    const saveBtn = document.getElementById('save-btn');

    const statNewDefects = document.getElementById('stat-new-defects');
    const statReworked = document.getElementById('stat-reworked');
    const statTodayInventory = document.getElementById('stat-today-inventory');

    const chartCanvas = document.getElementById('inventory-chart');

    // Data structure
    let dailyData = {};
    const dates = [];

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
        
        // The initial inventory of a day is the closing inventory of the previous day.
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
        const newDefects = parseInt(newDefectsInput.value) || 0;
        const reworked = parseInt(reworkedInput.value) || 0;

        const data = dailyData[selectedDate];
        data.newDefects = newDefects;
        data.reworked = reworked;
        data.todayInventory = data.initialInventory + newDefects - reworked;

        // Propagate changes to subsequent days
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
        // after propagating changes, reload the data for the currently selected date to show the correct initial inventory if a previous day was modified.
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
        const labels = dates;
        const inventoryData = dates.map(date => dailyData[date].todayInventory);
        const newDefectsData = dates.map(date => dailyData[date].newDefects);
        const reworkedData = dates.map(date => dailyData[date].reworked);

        if (inventoryChart) {
            inventoryChart.destroy();
        }

        inventoryChart = new Chart(chartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '일일 재고',
                        data: inventoryData,
                        borderColor: '#3f51b5',
                        backgroundColor: 'rgba(63, 81, 181, 0.1)',
                        fill: true,
                        tension: 0.1
                    },
                    {
                        label: '신규 불량',
                        data: newDefectsData,
                        borderColor: '#f44336',
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        tension: 0.1
                    },
                    {
                        label: '작업량',
                        data: reworkedData,
                        borderColor: '#4caf50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        tension: 0.1
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
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Event Listeners
    dateSelect.addEventListener('change', (e) => loadDataForDate(e.target.value));
    saveBtn.addEventListener('click', saveData);

    // Initial setup
    initializeData();
    updateChart();
});