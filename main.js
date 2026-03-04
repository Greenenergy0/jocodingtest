const moodHistoryList = document.getElementById('mood-history-list');

    let userData = {
        name: '',
        age: '',
        history: []
    };

    const messages = {
        happy: [
            "{name}님, 행복한 하루를 보내고 계시는군요! 그 미소 계속 간직하세요.",
            "계속해서 긍정적인 에너지를 주변에 나눠주세요, {name}님!",
            "행복은 나비와 같아서, 쫓아가면 잡을 수 없지만, 조용히 앉아 있으면 당신에게 내려앉을 거예요."
        ],
        sad: [
            "슬픈 감정은 잠시 머물다 가는 구름과 같아요, {name}님. 곧 맑은 하늘이 보일 거예요.",
            "힘든 시간을 보내고 계시군요. 괜찮아요, {name}님. 모든 것은 지나갈 거예요.",
            "때로는 실컷 울고 나면 마음이 후련해지기도 해요. 자신에게 솔직해져도 괜찮아요."
        ],
        anxious: [
            "{name}님, 불안한 마음이 드시나요? 깊게 숨을 들이마시고, 천천히 내쉬어보세요.",
            "미래에 대한 걱정은 잠시 내려놓고, 현재에 집중해보세요. {name}님은 충분히 잘하고 있어요.",
            "불안은 흔들 의자에 앉아 있는 것과 같아요. 계속 움직이지만 아무 데도 가지 않죠. 잠시 멈춰 서서 주변을 둘러보세요."
        ],
        tired: [
            "{name}님, 오늘 하루도 정말 수고 많으셨어요. 잠시 모든 것을 잊고 편안히 쉬세요.",
            "몸과 마음에 휴식을 주는 것은 매우 중요해요. {name}님, 오늘은 자신을 위한 시간을 가져보세요.",
            "가끔은 아무것도 하지 않을 자유가 필요해요. 재충전의 시간을 가지세요."
        ],
        angry: [
            "{name}님, 화가 나는 일이 있으셨군요. 그 감정을 잠시 떨어뜨려놓고 차분하게 생각해보는 건 어떨까요?",
            "화는 뜨거운 석탄과 같아서, 남에게 던지기 전에 먼저 내 손을 데게 만들어요. {name}님, 마음의 평화를 찾으시길 바라요.",
            "감정은 날씨와 같아요. 지금은 폭풍우가 몰아치지만, 곧 잠잠해지고 맑은 날이 올 거예요."
        ]
    };

    const renderHistory = () => {
        moodHistoryList.innerHTML = '';
        userData.history.forEach(entry => {
            const listItem = document.createElement('li');
            listItem.textContent = `${entry.date}: ${entry.mood}`;
            moodHistoryList.appendChild(listItem);
        });
    };

    const loadUserData = () => {
        const savedData = localStorage.getItem('comfortMessageUserData');
        if (savedData) {
            userData = JSON.parse(savedData);
            nameInput.value = userData.name;
            ageInput.value = userData.age;
            if (userData.history.length > 0) {
                 const lastMood = userData.history[userData.history.length - 1].mood;
                 messageDisplay.innerHTML = `<p>${userData.name}님, 다시 방문해주셨네요! 마지막으로 방문했을 때의 기분은 '${lastMood}'이었어요. 오늘은 어떠신가요?</p>`;
            }
            renderHistory();
        }
    };

    const saveUserData = () => {
        localStorage.setItem('comfortMessageUserData', JSON.stringify(userData));
    };

    const generateMessage = () => {
        const name = nameInput.value || '당신';
        const age = ageInput.value;
        const mood = moodSelect.value;

        if (!age) {
            alert('나이를 입력해주세요!');
            return;
        }
        
        userData.name = name;
        userData.age = age;

        let message = '';
        const history = userData.history;

        if (history.length > 0) {
            const lastMood = history[history.length - 1].mood;
            if (lastMood !== mood) {
                 message = `어제는 기분이 '${lastMood}'이셨는데, 오늘은 '${mood}'이시군요. `;
            }
        }

        const moodMessages = messages[mood];
        const randomIndex = Math.floor(Math.random() * moodMessages.length);
        message += moodMessages[randomIndex].replace('{name}', name);
        
        // Add new entry to history
        userData.history.push({ date: new Date().toISOString().split('T')[0], mood: mood });
        
        // Keep history to a reasonable size, e.g., last 10 entries
        if (userData.history.length > 10) {
            userData.history.shift();
        }

        messageDisplay.innerHTML = `<p>${message}</p>`;
        saveUserData();
        renderHistory();
    };

    generateBtn.addEventListener('click', generateMessage);

    loadUserData();
});