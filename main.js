document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const nameInput = document.getElementById('name');
    const moodSelect = document.getElementById('mood');
    const situationSelect = document.getElementById('situation');
    const generateBtn = document.getElementById('generate-btn');
    
    // Fun Factors Display
    const luckyChanceDisplay = document.getElementById('lucky-chance');
    const energyLevelDisplay = document.getElementById('energy-level');
    const luckyNumberDisplay = document.getElementById('lucky-number');
    const luckyColorDisplay = document.getElementById('lucky-color');

    // Message Display
    const messageStep1 = document.getElementById('message-step1');
    const messageStep2 = document.getElementById('message-step2');
    const messageStep3 = document.getElementById('message-step3');

    // History Display
    const moodHistoryList = document.getElementById('mood-history-list');

    // --- Data State ---
    let userData = {
        name: '',
        history: [] // Now stores { date, mood, situation }
    };

    // --- Message Database ---
    const messages = {
        work: {
            happy: {
                message: "{name}님, 직장에서의 성취감이 당신을 빛나게 하네요! 그 에너지를 동료들과도 나눠보세요.",
                question: "오늘의 성취를 어떻게 자축하고 싶으신가요? 혹은 이 기세를 몰아 다음 목표는 무엇인가요?",
                action: "오늘 성취한 일에 대해 짧게라도 기록을 남겨보세요. 미래의 당신에게 큰 힘이 될 거예요."
            },
            sad: {
                message: "일이 뜻대로 풀리지 않아 속상하셨군요, {name}님. 하지만 이 또한 성장의 과정일 거예요.",
                question: "지금 느끼는 감정을 솔직하게 털어놓을 수 있는 동료나 친구가 있나요?",
                action: "잠시 일에서 벗어나 짧은 산책을 하거나 차 한잔의 여유를 가져보세요."
            }
            // ... Add more moods for 'work'
        },
        money: {
            anxious: {
                message: "{name}님, 돈 문제로 마음이 불안하시군요. 혼자 끙끙 앓지 않는 것이 중요해요.",
                question: "불안감을 줄이기 위해 지금 당장 할 수 있는 작은 행동 한 가지는 무엇일까요?",
                action: "한 달 지출 내역을 간단하게라도 정리해보세요. 막연한 불안감을 줄이는 데 도움이 될 수 있어요."
            }
        },
        relationships: {
            happy: {
                message: "주변 사람들과의 관계에서 행복을 느끼고 계시는군요, {name}님. 정말 멋진 일이에요!",
                question: "당신을 행복하게 만드는 그 사람에게 오늘 어떤 말로 마음을 표현하고 싶으신가요?",
                action: "소중한 사람에게 작은 감사 메시지를 보내보세요. 관계가 더욱 돈독해질 거예요."
            }
        },
         mind: {
            tired: {
                message: "{name}님, 마음이 지쳐있는 상태이시군요. 재충전의 시간이 필요해 보여요.",
                question: "온전히 당신만을 위해 시간을 쓴다면 무엇을 하고 싶으신가요?",
                action: "좋아하는 음악을 듣거나, 따뜻한 목욕으로 몸과 마음의 긴장을 풀어주세요."
            }
        },
        growth: {
            anxious: {
                message: "성장에 대한 고민이 많으시군요, {name}님. 더 나은 내일을 꿈꾸는 당신은 이미 충분히 멋져요.",
                question: "당신이 생각하는 '성장'이란 무엇인가요? 어떤 모습이 되고 싶으신가요?",
                action: "이번 주, 당신의 성장을 위해 투자할 수 있는 작은 시간(예: 30분 책 읽기)을 계획해보세요."
            }
        }
        // ... Add more situations
    };

    // --- Functions ---

    const renderHistory = () => {
        moodHistoryList.innerHTML = '';
        userData.history.forEach(entry => {
            const listItem = document.createElement('li');
            listItem.textContent = `${entry.date}: ${entry.mood} (${entry.situation})`;
            moodHistoryList.appendChild(listItem);
        });
    };

    const loadUserData = () => {
        const savedData = localStorage.getItem('comfortMessageUserData');
        if (savedData) {
            userData = JSON.parse(savedData);
            nameInput.value = userData.name;
            if (userData.history.length > 0) {
                 const lastEntry = userData.history[userData.history.length - 1];
                 messageStep1.textContent = `${userData.name}님, 다시 오셨네요! 지난번엔 '${lastEntry.situation}'에 대해 '${lastEntry.mood}'의 감정을 느끼셨어요.`;
                 messageStep2.textContent = "오늘은 어떤 이야기를 들려주실 건가요?";
                 messageStep3.textContent = "";
            }
            renderHistory();
        }
    };

    const saveUserData = () => {
        localStorage.setItem('comfortMessageUserData', JSON.stringify(userData));
    };

    const generateFunFactors = () => {
        luckyChanceDisplay.textContent = `${Math.floor(Math.random() * 101)}%`;
        energyLevelDisplay.textContent = `${Math.floor(Math.random() * 101)}%`;
        luckyNumberDisplay.textContent = Math.floor(Math.random() * 100) + 1;
        
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        luckyColorDisplay.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    };

    const generateMessage = () => {
        const name = nameInput.value || '당신';
        const mood = moodSelect.value;
        const situation = situationSelect.value;

        userData.name = name;

        // Generate and display fun factors
        generateFunFactors();

        // Generate and display message
        let messageObj = messages[situation]?.[mood];
        
        if (!messageObj) {
            // Default message if a specific combination doesn't exist
            messageObj = {
                 message: `{name}님, 오늘 하루는 어떠셨나요? 당신의 이야기가 궁금해요.`,
                 question: `지금 가장 마음 속에 맴도는 단어는 무엇인가요?`,
                 action: `그 단어를 종이에 적고, 떠오르는 생각들을 자유롭게 적어보세요.`
            }
        }

        messageStep1.textContent = messageObj.message.replace('{name}', name);
        messageStep2.textContent = messageObj.question;
        messageStep3.textContent = messageObj.action;
        
        // Add new entry to history
        userData.history.push({ date: new Date().toISOString().split('T')[0], mood, situation });
        
        // Keep history to a reasonable size
        if (userData.history.length > 10) {
            userData.history.shift();
        }

        saveUserData();
        renderHistory();
    };

    // --- Event Listeners ---
    generateBtn.addEventListener('click', generateMessage);

    // --- Initial Load ---
    loadUserData();
});