const { jsPDF } = window.jspdf;
// DOM Elements
const ui = {
    themeToggle: document.getElementById('theme-toggle'),
    themeIconLight: document.getElementById('theme-icon-light'),
    themeIconDark: document.getElementById('theme-icon-dark'),
    generateBtn: document.getElementById('generate-btn'),
    courseTopicInput: document.getElementById('course-topic'),
    exampleTopicButtons: document.querySelectorAll('.example-topic-btn'),
    book: document.getElementById('book'),
    backBtn: document.getElementById('back-btn'),
    loader: document.getElementById('loader'),
    resultsContainer: document.getElementById('results'),
    errorMessage: document.getElementById('error-message'),
    contentLoader: document.getElementById('content-loader'),
    contentPlaceholder: document.getElementById('content-placeholder'),
    contentDisplay: document.getElementById('content-display'),
    saveStatus: document.getElementById('save-status'),
    historyBtn: document.getElementById('history-btn'),
    historyPanel: document.getElementById('history-panel'),
    historyList: document.getElementById('history-list'),
    tutorSection: document.getElementById('tutor-section'),
    tutorBtn: document.getElementById('tutor-btn'),
    tutorChatBox: document.getElementById('tutor-chat-box'),
    tutorChatHistory: document.getElementById('tutor-chat-history'),
    tutorInput: document.getElementById('tutor-input'),
    tutorSendBtn: document.getElementById('tutor-send-btn'),
    notesSection: document.getElementById('notes-section'),
    notesBtn: document.getElementById('notes-btn'),
    notesLoader: document.getElementById('notes-loader'),
    notesContent: document.getElementById('notes-content'),
    assessmentSection: document.getElementById('assessment-section'),
    assessmentActions: document.getElementById('assessment-actions'),
    assessmentLoader: document.getElementById('assessment-loader'),
    assessmentContent: document.getElementById('assessment-content'),
    practiceBtn: document.getElementById('practice-btn'),
    testBtn: document.getElementById('test-btn'),
    previewBtn: document.getElementById('preview-btn'),
    downloadPdfBtn: document.getElementById('download-pdf-btn'),
};

// App State
let db, auth, userId, activeCourseId;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
let currentLessonInfo = { topic: '', title: '', content: '' };
let chatHistory = [];

// --- THEME ---
function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        ui.themeIconLight.classList.add('hidden');
        ui.themeIconDark.classList.remove('hidden');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        ui.themeIconLight.classList.remove('hidden');
        ui.themeIconDark.classList.add('hidden');
    }
}
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('courseBuilderTheme', newTheme);
    applyTheme(newTheme);
}

// --- FIREBASE SETUP ---
async function initializeFirebase() {
    try {
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        handleAuthentication();
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        ui.saveStatus.textContent = "Offline Mode";
    }
}
function handleAuthentication() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            userId = user.uid;
            await loadCourseHistory();
        } else {
            try {
                await auth.signInAnonymously();
            } catch (error) {
                console.error("Anonymous sign-in failed:", error);
                ui.saveStatus.textContent = "Login Failed";
            }
        }
    });
}

// --- DATA PERSISTENCE ---
async function saveCourseToFirestore(topic, outlineHtml, totalLessons) {
    if (!userId || !db) return;
    ui.saveStatus.textContent = 'Saving...';
    try {
        const courseRef = await db.collection(`artifacts/${appId}/users/${userId}/courses`).add({
            topic,
            outlineHtml,
            totalLessons,
            completedLessons: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        activeCourseId = courseRef.id;
        ui.saveStatus.textContent = 'Saved';
        await loadCourseHistory();
    } catch (error) {
        console.error("Error saving course:", error);
        ui.saveStatus.textContent = 'Save Failed';
    }
}
async function saveProgressToFirestore() {
    if (!userId || !db || !activeCourseId) return;
    const completedLessons = Array.from(document.querySelectorAll('.lesson-checkbox:checked'))
        .map(cb => cb.dataset.lessonTitle);
    try {
        const courseRef = db.doc(`artifacts/${appId}/users/${userId}/courses/${activeCourseId}`);
        await courseRef.update({ completedLessons });
        ui.saveStatus.textContent = 'Progress Saved';
        await loadCourseHistory();
    } catch (error) {
        console.error("Error saving progress:", error);
        ui.saveStatus.textContent = 'Progress Save Failed';
    }
}
async function loadCourseHistory() {
    if (!userId || !db) return;
    ui.historyList.innerHTML = `<div class="text-center p-4">Loading history...</div>`;
    try {
        const querySnapshot = await db.collection(`artifacts/${appId}/users/${userId}/courses`)
                                      .orderBy("createdAt", "desc")
                                      .get();
        
        if (querySnapshot.empty) {
            ui.historyList.innerHTML = `<p class="text-center text-lg p-8">Your saved courses will appear here.</p>`;
            return;
        }

        ui.historyList.innerHTML = '';
        let isFirstCourse = true;
        querySnapshot.forEach(docSnap => {
            const course = docSnap.data();
            const courseId = docSnap.id;
            
            const completedCount = course.completedLessons ? course.completedLessons.length : 0;
            const totalCount = course.totalLessons || 0;
            const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
            
            const historyItem = document.createElement('div');
            historyItem.className = `history-item p-4 rounded-lg cursor-pointer hover:bg-[var(--input-bg)] transition-colors`;
            historyItem.dataset.courseId = courseId;
            
            const radius = 16;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (progress / 100) * circumference;

            historyItem.innerHTML = `
                <h3 class="font-bold text-[var(--text-primary)] truncate">${course.topic}</h3>
                <div class="flex items-center gap-3 mt-2">
                    <svg class="progress-circle w-10 h-10" viewBox="0 0 36 36">
                        <circle class="progress-circle-bg" cx="18" cy="18" r="${radius}" fill="none" stroke-width="3"></circle>
                        <circle class="progress-circle-fg" cx="18" cy="18" r="${radius}" fill="none" stroke-width="3" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
                    </svg>
                    <span class="text-sm font-semibold text-[var(--text-tertiary)]">${completedCount} / ${totalCount} lessons</span>
                </div>
            `;
            historyItem.addEventListener('click', () => loadSpecificCourse(courseId));
            ui.historyList.appendChild(historyItem);
            
            if (isFirstCourse) {
                loadSpecificCourse(courseId);
                isFirstCourse = false;
            }
        });
    } catch (error) {
        console.error("Error loading course history:", error);
        ui.historyList.innerHTML = `<p class="text-red-500 text-center">Failed to load history.</p>`;
    }
}
async function loadSpecificCourse(courseId) {
    if (!userId || !db) return;
    activeCourseId = courseId;
     ui.historyPanel.classList.add('hidden');
    document.querySelectorAll('.history-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`.history-item[data-course-id="${courseId}"]`).classList.add('active');

    try {
        const courseRef = db.doc(`artifacts/${appId}/users/${userId}/courses/${courseId}`);
        const docSnap = await courseRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            ui.courseTopicInput.value = data.topic || '';
            ui.resultsContainer.innerHTML = data.outlineHtml || '';
            applyProgress(data.completedLessons || []);
            if (ui.book.classList.contains('is-flipped')) {
                ui.book.classList.remove('is-flipped');
            }
        }
    } catch (error) {
        console.error("Error loading specific course:", error);
    }
}

// --- UI & EVENT LISTENERS ---
ui.generateBtn.addEventListener('click', handleGenerateCourse);
ui.backBtn.addEventListener('click', () => ui.book.classList.remove('is-flipped'));
ui.themeToggle.addEventListener('click', toggleTheme);
ui.exampleTopicButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        ui.courseTopicInput.value = btn.textContent;
        handleGenerateCourse();
    });
});
ui.resultsContainer.addEventListener('change', (e) => {
    if (e.target.classList.contains('lesson-checkbox')) {
        saveProgressToFirestore();
    }
});
ui.historyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    ui.historyPanel.classList.toggle('hidden');
});
document.addEventListener('click', (e) => {
    if (!ui.historyPanel.contains(e.target) && !ui.historyBtn.contains(e.target)) {
         ui.historyPanel.classList.add('hidden');
    }
});
ui.tutorBtn.addEventListener('click', () => ui.tutorChatBox.classList.toggle('hidden'));
ui.tutorSendBtn.addEventListener('click', handleTutorChat);
ui.tutorInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleTutorChat(); });
ui.notesBtn.addEventListener('click', handleGenerateNotes);
ui.practiceBtn.addEventListener('click', () => handleGenerateAssessment('practice'));
ui.testBtn.addEventListener('click', () => handleGenerateAssessment('test'));
ui.previewBtn.addEventListener('click', () => window.print());
ui.downloadPdfBtn.addEventListener('click', handleDownloadPdf);

// --- CORE LOGIC ---
function applyProgress(completedLessons) {
    document.querySelectorAll('.lesson-checkbox').forEach(checkbox => {
        checkbox.checked = completedLessons.includes(checkbox.dataset.lessonTitle);
    });
}
function parseMarkdown(text) {
     return text.replace(/^### (.*$)/gim, '<h3>$1</h3>')
                .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/^[\*\-]\s(.*$)/gim, '<li class="ml-4">$1</li>')
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br>');
}
function parseMarkdownForOutline(text) {
     let html = text.replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-4 mb-2">$1</h3>')
                    .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-6 mb-3 pb-2 border-b border-[var(--border-color)]">$1</h2>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
     html = html.replace(/^[\*\-]\s(.*$)/gim, `<li class="lesson-item"><div class="flex items-center gap-3"><input type="checkbox" class="lesson-checkbox w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded" data-lesson-title="$1"><a href="#" class="lesson-link block p-2.5 rounded-md hover:bg-[var(--input-bg)] transition-colors flex-grow" onclick="window.handleGenerateLessonContent(event, this)" data-lesson-title="$1">$1</a></div></li>`);
     return `<ul class="space-y-1">${html}</ul>`;
}

async function callGeminiAPIStream(userPrompt, systemPrompt, onChunk, onComplete, history = []) {
    const apiKey = "AIzaSyDwZhCINhotsQZCrQ8NSQeSju8J9WvCjaE";
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:streamGenerateContent?alt=sse&key=${apiKey}`;
    const contents = [...history, { role: "user", parts: [{ text: userPrompt }] }];
    const payload = { contents, systemInstruction: { parts: [{ text: systemPrompt }] } };

    const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponseText = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); 
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.substring(6));
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (text) {
                        fullResponseText += text;
                        onChunk(text);
                    }
                } catch (e) { console.warn("Could not parse JSON chunk:", line); }
            }
        }
    }
    if(onComplete) onComplete(fullResponseText);
}

async function handleGenerateCourse() {
    if (ui.book.classList.contains('is-flipped')) ui.book.classList.remove('is-flipped');
    const topic = ui.courseTopicInput.value.trim();
    if (!topic) {
        ui.errorMessage.textContent = 'Please enter a course topic.';
        ui.errorMessage.classList.remove('hidden');
        return;
    }
    
    ui.errorMessage.classList.add('hidden');
    ui.resultsContainer.innerHTML = '';
    ui.loader.classList.remove('hidden');
    ui.generateBtn.disabled = true;

    const systemPrompt = `You are an expert instructional designer. Create a comprehensive course outline in Markdown. The structure must include: Course Title, Course Description, Prerequisites, Learning Objectives, and Course Modules. Inside each module, list several lessons using standard bullet points.`;
    
    try {
        let fullText = "";
        let tempDiv = document.createElement('div');
        await callGeminiAPIStream(topic, systemPrompt, 
        (chunk) => {
            fullText += chunk;
            ui.resultsContainer.innerHTML = parseMarkdownForOutline(fullText);
        },
        async (fullResponse) => {
            tempDiv.innerHTML = ui.resultsContainer.innerHTML;
            const totalLessons = tempDiv.querySelectorAll('.lesson-link').length;
            await saveCourseToFirestore(topic, ui.resultsContainer.innerHTML, totalLessons);
        });
    } catch (error) {
        console.error("Outline generation error:", error);
        ui.errorMessage.textContent = `Failed to generate course outline: ${error.message}. Please check your internet connection and try again.`;
        ui.errorMessage.classList.remove('hidden');
    } finally {
        ui.loader.classList.add('hidden');
        ui.generateBtn.disabled = false;
    }
}

window.handleGenerateLessonContent = async function(event, element) {
    event.preventDefault();
    currentLessonInfo.title = element.dataset.lessonTitle;
    currentLessonInfo.topic = ui.courseTopicInput.value.trim();

    ui.book.classList.add('is-flipped');
    ui.contentPlaceholder.classList.add('hidden');
    
    ui.tutorSection.classList.add('hidden');
    ui.tutorChatBox.classList.add('hidden');
    ui.tutorChatHistory.innerHTML = '';
    chatHistory = [];
    ui.notesSection.classList.add('hidden');
    ui.notesContent.innerHTML = '';
    ui.assessmentSection.classList.add('hidden');
    ui.assessmentContent.innerHTML = '';
    ui.contentDisplay.innerHTML = ''; 
    ui.contentLoader.classList.remove('hidden');
    
    const systemPrompt = `You are an expert educator. Generate detailed, engaging lesson content in Markdown. The structure should include an Introduction, Core Concepts, Examples, and a Key Takeaway. Format headings with ## and ###. Use bolding for key terms.`;
    const userPrompt = `The main course topic is "${currentLessonInfo.topic}". Generate the lesson content for: "${currentLessonInfo.title}".`;
    
    const cursor = document.createElement('span');
    cursor.className = 'blinking-cursor';
    
    try {
        let fullText = "";
        await callGeminiAPIStream(userPrompt, systemPrompt, 
        (chunk) => {
            if (!ui.contentLoader.classList.contains('hidden')) ui.contentLoader.classList.add('hidden');
            fullText += chunk;
            ui.contentDisplay.innerHTML = `<div class="page-content pt-12">${parseMarkdown(fullText)}</div>`;
            ui.contentDisplay.appendChild(cursor);
        }, 
        (fullResponse) => {
             currentLessonInfo.content = fullResponse;
             ui.tutorSection.classList.remove('hidden');
             ui.notesSection.classList.remove('hidden');
             ui.assessmentSection.classList.remove('hidden');
        });
    } catch (error) {
        console.error("Lesson content generation error:", error);
        ui.contentDisplay.innerHTML = `<p class="text-red-500">Error generating lesson content: ${error.message}. Please try again.</p>`;
    } finally {
        ui.contentLoader.classList.add('hidden');
        cursor.remove();
    }
}

async function handleTutorChat() {
    const userQuestion = ui.tutorInput.value.trim();
    if (!userQuestion) return;
    ui.tutorInput.value = '';
    
    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble-user p-3 rounded-lg mb-2 self-end max-w-[80%]';
    userBubble.textContent = userQuestion;
    ui.tutorChatHistory.appendChild(userBubble);
    ui.tutorChatHistory.scrollTop = ui.tutorChatHistory.scrollHeight;

    const systemPrompt = `You are a supportive AI tutor. Provide clear, step-by-step explanations to help learners understand concepts better. Keep answers concise yet educational.`;
    const userPrompt = `Course: "${currentLessonInfo.topic}"\nLesson: "${currentLessonInfo.title}"\nContent: """${currentLessonInfo.content}"""\nLearner's question: ${userQuestion}`;
    
    const aiBubble = document.createElement('div');
    aiBubble.className = 'chat-bubble-ai p-3 rounded-lg mb-2 self-start max-w-[80%]';
    ui.tutorChatHistory.appendChild(aiBubble);
    
    try {
        let fullText = "";
        await callGeminiAPIStream(userPrompt, systemPrompt, 
        (chunk) => {
            fullText += chunk;
            aiBubble.textContent = fullText;
            ui.tutorChatHistory.scrollTop = ui.tutorChatHistory.scrollHeight;
        });
    } catch (error) {
        console.error("Tutor chat error:", error);
        aiBubble.textContent = `Error: ${error.message}`;
    }
}

async function handleGenerateNotes() {
    ui.notesSection.classList.remove('hidden');
    ui.notesLoader.classList.remove('hidden');
    ui.notesContent.innerHTML = '';

    const systemPrompt = `You are an expert note-taker. Summarize the lesson into concise, clear notes. Use bullet points and highlight key terms. Format in Markdown.`;
    const userPrompt = `Summarize the lesson content: """${currentLessonInfo.content}"""`;

    try {
        let fullText = "";
        await callGeminiAPIStream(userPrompt, systemPrompt, 
        (chunk) => {
            if (!ui.notesLoader.classList.contains('hidden')) ui.notesLoader.classList.add('hidden');
            fullText += chunk;
            ui.notesContent.innerHTML = `<div class="page-content">${parseMarkdown(fullText)}</div>`;
        });
    } catch (error) {
        console.error("Notes generation error:", error);
        ui.notesContent.innerHTML = `<p class="text-red-500">Error generating notes: ${error.message}</p>`;
    } finally {
        ui.notesLoader.classList.add('hidden');
    }
}

async function handleGenerateAssessment(type) {
    ui.assessmentSection.classList.remove('hidden');
    ui.assessmentLoader.classList.remove('hidden');
    ui.assessmentContent.innerHTML = '';

    const systemPrompt = `You are an experienced test designer. Create a ${type} assessment based on the lesson. Include multiple-choice questions with 4 options, and mark the correct answer with **. Format in Markdown.`;
    const userPrompt = `Generate a ${type} assessment for the lesson content: """${currentLessonInfo.content}"""`;

    try {
        let fullText = "";
        await callGeminiAPIStream(userPrompt, systemPrompt, 
        (chunk) => {
            if (!ui.assessmentLoader.classList.contains('hidden')) ui.assessmentLoader.classList.add('hidden');
            fullText += chunk;
            ui.assessmentContent.innerHTML = `<div class="page-content">${parseMarkdown(fullText)}</div>`;
        });
    } catch (error) {
        console.error("Assessment generation error:", error);
        ui.assessmentContent.innerHTML = `<p class="text-red-500">Error generating assessment: ${error.message}</p>`;
    } finally {
        ui.assessmentLoader.classList.add('hidden');
    }
}

async function handleDownloadPdf() {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const content = ui.contentDisplay.cloneNode(true);

        content.querySelectorAll('.blinking-cursor, #tutor-section, #notes-section, #assessment-section, #preview-btn, #download-pdf-btn').forEach(el => el.remove());
        
        const htmlContent = content.innerHTML;

        await doc.html(htmlContent, {
            callback: function (doc) { doc.save(`${currentLessonInfo.title}.pdf`); },
            x: 10, y: 10, width: 190, windowWidth: 800
        });
    } catch (error) {
        console.error("PDF generation error:", error);
        alert("Error generating PDF. Please try again.");
    }
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    applyTheme(localStorage.getItem('courseBuilderTheme') || 'light');
    initializeFirebase();
});
