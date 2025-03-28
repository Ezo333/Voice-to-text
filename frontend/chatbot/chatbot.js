const SERVER_URL = 'http://localhost:5001';
const VALID_ROOMS = ['нэг', 'хоёр', 'гурав', 'дөрөв', 'тав', 'зургаа', 'долоо', 'найм', 'ес', 'арав'];
const BUILDING = 'Хич-7 гурван зуун';

let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let currentState = 'INIT'; 
let selectedRoom = null;

const voiceButton = document.getElementById('voice-button');
const statusText = document.getElementById('status-text');
const chatMessages = document.getElementById('chat-messages');

function extractRoomNumber(text) {
    const numbers = {
        'нэг': 'нэг',
        'хоёр': 'хоёр',
        'гурав': 'гурав',
        'дөрөв': 'дөрөв',
        'тав': 'тав',
        'зургаа': 'зургаа',
        'долоо': 'долоо',
        'найм': 'найм',
        'ес': 'ес',
        'арав': 'арав'
    };
    
    let roomNumber = null;
    for (const [num, word] of Object.entries(numbers)) {
        if (text.toLowerCase().includes(word)) {
            roomNumber = word;
            break;
        }
    }
    return roomNumber;
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const formData = new FormData();
            formData.append('audio', audioBlob);
        
            try {
                const response = await fetch('http://localhost:5001/process_audio', {
                    method: 'POST',
                    body: formData
                });
                setTimeout(async () => {
                    const data = await response.json();
                    if (data.text) {
                        const processedText = data.text.trim();
                        addMessage('user', processedText);
                        await processUserInput(processedText);
                    }
                }, 300); 
            } catch (error) {
                console.error('Error processing audio:', error);
                addMessage('bot', 'Уучлаарай, алдаа гарлаа.');
            }
        
            audioChunks = [];
        };
        
        mediaRecorder.start();
        isRecording = true;
        voiceButton.textContent = 'Микрофоныг xaax';
        statusText.textContent = 'Сонсоч байна...';
        
    } catch (error) {
        console.error('Error accessing microphone:', error);
        statusText.textContent = 'Микрофон холбоход алдаа гарлаа';
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        voiceButton.textContent = 'Микрофоныг нээх';
        statusText.textContent = 'Ярьж эхлэхийн тулд товчийг дарна уу';
    }
}

function addMessage(sender, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.textContent = `${sender === 'bot' ? 'Чатбот: ' : 'Та: '}${text}`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function displayFreeSlots(slots) {
    const slotsContainer = document.createElement('div');
    slotsContainer.className = 'slots-container';
    
    slots.forEach((slot, index) => {
        const slotButton = document.createElement('button');
        slotButton.className = 'slot-button';
        slotButton.textContent = `${index + 1}. ${slot.Өдөр} ${slot.Эхлэх_Цаг} - ${slot.Дуусах_Цаг}`;
        slotButton.onclick = () => selectTimeSlot(slot);
        slotsContainer.appendChild(slotButton);
    });
    
    chatMessages.appendChild(slotsContainer);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function processUserInput(text) {
    switch (currentState) {
        case 'INIT':
            const roomNumber = extractRoomNumber(text);
            if (roomNumber && VALID_ROOMS.includes(roomNumber)) {
                selectedRoom = roomNumber;
                currentState = 'WAITING_FOR_DAY';
                addMessage('bot', `${roomNumber} анги сонгогдлоо. Аль өдөр захиалах вэ? (Даваа-Баасан)`);
            } else {
                addMessage('bot', 'Уучлаарай, та зөв анги дугаар хэлнэ үү.');
            }
            break;

        case 'WAITING_FOR_DAY':

            // Map day names from Mongolian to your database values if needed
            const dayMap = {
                "даваа": "даваа",
                "мягмар": "мягмар",
                "лягва": "лхагва",
                "пүрэв": "пүрэв",
                "бямба": "бямба",
            };

            if (dayMap[text]) {
                try {
                    const response = await fetch('http://localhost:5001/get_free_slots', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            building: BUILDING, 
                            room_number: selectedRoom,
                            day_of_week: dayMap[text] 
                        })
                    });

                    const data = await response.json();
                    if (data.slots && data.slots.length > 0) {
                        addMessage('bot', 'Дараах цагуудаас сонгоно уу:');
                        displayFreeSlots(data.slots);
                        currentState = 'SHOWING_SLOTS';
                    } else {
                        addMessage('bot', 'Уучлаарай, сул цаг олдсонгүй. Өөр өдөр сонгоно уу.');
                    }
                } catch (error) {
                    console.error('Error fetching slots:', error);
                    addMessage('bot', 'Уучлаарай, алдаа гарлаа.');
                }
            } else {
                addMessage('bot', 'Уучлаарай, таны бичсэн өдөр буруу байна. Даваа-Ням гэж бичнэ үү.');
            }
            break;
    }
}

async function selectTimeSlot(slot) {
    try {
        const response = await fetch('http://localhost:5001/update_slot_status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                building: BUILDING,
                room_number: selectedRoom,
                day: slot.Өдөр,
                start_time: slot.Эхлэх_Цаг,
                end_time: slot.Дуусах_Цаг
            })
        });
        
        const data = await response.json();
        if (data.success) {
            addMessage('bot', `Захиалга амжилттай: ${BUILDING} ${selectedRoom} анги, ${slot.Өдөр} ${slot.Эхлэх_Цаг} - ${slot.Дуусах_Цаг}`);
            currentState = 'INIT';
            selectedRoom = null;
        } else {
            addMessage('bot', 'Уучлаарай, захиалга хийхэд алдаа гарлаа.');
        }
    } catch (error) {
        console.error('Error updating slot:', error);
        addMessage('bot', 'Уучлаарай, алдаа гарлаа.');
    }
}

voiceButton.addEventListener('click', () => {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    window.location.href = '../login/login.html';
});
