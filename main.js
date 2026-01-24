const generateBtn = document.getElementById('generate-btn');
const currentNumbersContainer = document.getElementById('current-numbers');
const historyList = document.getElementById('history-list');

const history = [];

const generateNumbers = () => {
    const numbers = new Set();
    while (numbers.size < 6) {
        numbers.add(Math.floor(Math.random() * 45) + 1);
    }
    return Array.from(numbers).sort((a, b) => a - b);
};

const updateCurrentNumbers = (numbers) => {
    currentNumbersContainer.innerHTML = '';
    numbers.forEach(number => {
        const numberEl = document.createElement('div');
        numberEl.classList.add('number');
        numberEl.textContent = number;
        currentNumbersContainer.appendChild(numberEl);
    });
};

const updateHistory = (numbers) => {
    history.unshift(numbers.join(', '));
    if (history.length > 10) {
        history.pop();
    }

    historyList.innerHTML = '';
    history.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        historyList.appendChild(li);
    });
};

generateBtn.addEventListener('click', () => {
    const newNumbers = generateNumbers();
    updateCurrentNumbers(newNumbers);
    updateHistory(newNumbers);
});
