document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const generateRangeBtn = document.getElementById('generate-range-btn');
    const csvUpload = document.getElementById('csv-upload');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const dateSelect = document.getElementById('date-select');
    const initialInventoryInput = document.getElementById('initial-inventory');
    const newDefectsInput = document.getElementById('new-defects');
    const reworkedInput = document.getElementById('reworked');
    const saveBtn = document.getElementById('save-btn');
    const statNewDefects = document.getElementById('stat-new-defects');
    const statReworked = document.getElementById('stat-reworked');
    const statTodayInventory = document.getElementById('stat-today-inventory');
    const chartCanvas = document.getElementById('inventory-chart');
    const downloadSummaryBtn = document.getElementById('download-summary-btn');
    const downloadChartBtn = document.getElementById('download-chart-btn');
    const summarySection = document.getElementById('summary-section');

    // --- Data State ---
    let dailyData = {};
    let dates = [];
    let lastModifiedDateIndex = -1;
    let inventoryChart;

    // --- Functions ---

    /**
     * Resets and generates the data structure for a given date range.
     */
    function generateDateRange() {
        const startDate = new Date(startDateInput.value);
        const endDate = new Date(endDateInput.value);

        if (isNaN(startDate) || isNaN(endDate) || startDate > endDate) {
            alert('유효한 시작일과 종료일을 선택해주세요.');
            return;
        }

        // Reset state
        dates = [];
        dailyData = {};
        lastModifiedDateIndex = -1;
        dateSelect.innerHTML = '';

        for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateString = d.toISOString().split('T')[0];
            dates.push(dateString);
            dailyData[dateString] = { initialInventory: 0, newDefects: 0, reworked: 0, todayInventory: 0 };
        }

        populateDateSelector();
        if (dates.length > 0) {
            dateSelect.disabled = false;
            loadDataForDate(dates[0]);
        } else {
            dateSelect.disabled = true;
        }
        updateChart();
    }
    
    /**
     * Populates the date dropdown based on the `dates` array.
     */
    function populateDateSelector() {
        dateSelect.innerHTML = '';
        dates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            option.textContent = date;
            dateSelect.appendChild(option);
        });
        if(dates.length > 0) {
            dateSelect.value = dates[0];
        }
    }

    /**
     * Loads the UI with data for the selected date.
     * @param {string} date - The date string to load data for.
     */
    function loadDataForDate(date) {
        if (!dailyData[date]) return;

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

    /**
     * Saves the current input values to the in-memory data store.
     */
    function saveData() {
        const selectedDate = dateSelect.value;
        if (!selectedDate) {
            alert('먼저 기간을 생성해주세요.');
            return;
        }

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

    /**
     * Propagates inventory changes to all subsequent dates.
     * @param {string} startDate - The date from which to start recalculating.
     */
    function updateSubsequentDays(startDate) {
        const startIndex = dates.indexOf(startDate);
        for (let i = startIndex + 1; i < dates.length; i++) {
            const currentDate = dates[i];
            const previousDate = dates[i-1];
            dailyData[currentDate].initialInventory = dailyData[previousDate].todayInventory;
            dailyData[currentDate].todayInventory = dailyData[currentDate].initialInventory + dailyData[currentDate].newDefects - dailyData[currentDate].reworked;
        }
        loadDataForDate(dateSelect.value); // Refresh UI for current day
    }

    /**
     * Updates the statistics display.
     * @param {string} date - The date to show stats for.
     */
    function updateStats(date) {
        const data = dailyData[date];
        if (!data) return;
        statNewDefects.textContent = data.newDefects;
        statReworked.textContent = data.reworked;
        statTodayInventory.textContent = data.todayInventory;
    }

    /**
     * Exports the current `dailyData` to a CSV file.
     */
    function exportToCsv() {
        if (dates.length === 0) {
            alert('저장할 데이터가 없습니다.');
            return;
        }
        const header = 'Date,NewDefects,Reworked\n';
        const rows = dates.map(date => {
            const data = dailyData[date];
            return `${date},${data.newDefects},${data.reworked}`;
        }).join('\n');

        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `rework-data-${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    /**
     * Handles the CSV file upload and parsing.
     * @param {Event} event - The file input change event.
     */
    function handleCsvUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const text = e.target.result;
            const rows = text.split('\n').slice(1); // Skip header

            // Reset state
            dates = [];
            dailyData = {};
            lastModifiedDateIndex = -1;

            rows.forEach((row, index) => {
                const [date, newDefects, reworked] = row.split(',');
                if (date) {
                    const cleanDate = date.trim();
                    dates.push(cleanDate);
                    dailyData[cleanDate] = {
                        initialInventory: 0, // Will be calculated
                        newDefects: parseInt(newDefects) || 0,
                        reworked: parseInt(reworked) || 0,
                        todayInventory: 0 // Will be calculated
                    };
                    if(parseInt(newDefects) > 0 || parseInt(reworked) > 0) {
                        lastModifiedDateIndex = index;
                    }
                }
            });
            
            // Set date pickers to reflect loaded data
            if(dates.length > 0) {
                startDateInput.value = dates[0];
                endDateInput.value = dates[dates.length - 1];
            }

            // Recalculate all inventories
            dates.forEach((date, index) => {
                const prevDate = index > 0 ? dates[index - 1] : null;
                const prevInventory = prevDate ? dailyData[prevDate].todayInventory : 0;
                dailyData[date].initialInventory = prevInventory;
                dailyData[date].todayInventory = prevInventory + dailyData[date].newDefects - dailyData[date].reworked;
            });

            populateDateSelector();
            dateSelect.disabled = false;
            loadDataForDate(dates[0]);
            updateChart();
        };
        reader.readAsText(file);
        csvUpload.value = ''; // Reset file input
    }
    
    /**
     * Redraws the chart based on the current data state.
     */
    function updateChart() {
        const displayIndex = lastModifiedDateIndex === -1 ? dates.length -1 : Math.min(lastModifiedDateIndex + 1, dates.length - 1) ;
        
        const labels = dates.slice(0, displayIndex + 1);
        if (labels.length === 0) { // Clear chart if no data
            if (inventoryChart) inventoryChart.destroy();
            return;
        }

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
                datasets: [{
                    type: 'bar', label: '일일 재고', data: inventoryData,
                    backgroundColor: 'rgba(63, 81, 181, 0.5)',
                    yAxisID: 'y'
                }, {
                    type: 'bar', label: '신규 불량', data: newDefectsData,
                    backgroundColor: 'rgba(244, 67, 54, 0.7)', yAxisID: 'y'
                }, {
                    type: 'bar', label: '작업량', data: reworkedData,
                    backgroundColor: 'rgba(76, 175, 80, 0.7)', yAxisID: 'y'
                }]
            },
            options: {
                responsive: true,
                plugins: { title: { display: true, text: '기간별 재고, 신규 불량 및 작업량 추이' } },
                scales: { y: { beginAtZero: true, position: 'left' } }
            }
        });
    }

    function downloadChart() {
        if (!inventoryChart || dates.length === 0) {
            alert('다운로드할 차트가 없습니다.');
            return;
        }
        const link = document.createElement('a');
        link.href = inventoryChart.toBase64Image();
        link.download = `rework-chart-${new Date().toISOString().split('T')[0]}.png`;
        link.click();
    }

    function downloadSummary() {
         html2canvas(summarySection).then(canvas => {
            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = image;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            link.download = `rework-summary-${timestamp}.png`;
            link.click();
        });
    }
    
    function getPreviousDate(dateString) {
        const date = new Date(dateString);
        date.setDate(date.getDate() - 1);
        return date.toISOString().split('T')[0];
    }

    // --- Event Listeners ---
    generateRangeBtn.addEventListener('click', generateDateRange);
    csvUpload.addEventListener('change', handleCsvUpload);
    exportCsvBtn.addEventListener('click', exportToCsv);
    dateSelect.addEventListener('change', (e) => loadDataForDate(e.target.value));
    saveBtn.addEventListener('click', saveData);
    downloadChartBtn.addEventListener('click', downloadChart);
    downloadSummaryBtn.addEventListener('click', downloadSummary);
});