// Функция для безопасного отображения HTML (перемещаем в начало файла)
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function addAnswerField() {
    const answersContainer = document.getElementById('answersContainer');
    const answerNumber = answersContainer.children.length + 1;
    
    const answerGroup = document.createElement('div');
    answerGroup.className = 'form-group answer-group';
    
    answerGroup.innerHTML = `
        <input type="text" name="answer${answerNumber}" placeholder="Введите вариант ответа" required>
        <div class="radio-container">
            <input type="radio" name="correctAnswer" value="${answerNumber - 1}" required>
            <span class="radio-label">Правильный ответ</span>
        </div>
    `;
    
    answersContainer.appendChild(answerGroup);
}

document.addEventListener('DOMContentLoaded', async function() {
    // Проверяем статус подключения к БД
    try {
        const statusResponse = await fetch('/api/db-status');
        const status = await statusResponse.json();
        if (!status.connected) {
            console.error('База данных не подключена');
            alert('Ошибка подключения к базе данных');
            return;
        }
    } catch (error) {
        console.error('Ошибка проверки статуса БД:', error);
    }

    const addQuestionForm = document.getElementById('addQuestionForm');
    const addAnswerBtn = document.getElementById('addAnswerBtn');
    const answersContainer = document.getElementById('answersContainer');
    let answerCount = 1;

    // Добавление нового варианта ответа
    addAnswerBtn.addEventListener('click', () => {
        answerCount++;
        const answerGroup = document.createElement('div');
        answerGroup.className = 'form-group answer-group';
        answerGroup.innerHTML = `
            <label>Вариант ответа ${answerCount}:</label>
            <input type="text" name="answer${answerCount}" required>
            <input type="radio" name="correctAnswer" value="${answerCount - 1}" required>
            <label class="radio-label">Правильный ответ</label>
            <button type="button" class="remove-answer">Удалить</button>
        `;
        answersContainer.appendChild(answerGroup);
    });

    // Удаление варианта ответа
    answersContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-answer')) {
            e.target.parentElement.remove();
        }
    });

    // Отправка формы
    addQuestionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(addQuestionForm);
        const questionData = {
            questionText: formData.get('questionText'),
            answers: [],
            correctAnswer: parseInt(formData.get('correctAnswer'))
        };

        // Собираем все варианты ответов
        const answerInputs = addQuestionForm.querySelectorAll('input[type="text"]');
        answerInputs.forEach(input => {
            questionData.answers.push(input.value);
        });

        try {
            const response = await fetch('/api/questions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(questionData)
            });

            const data = await response.json();

            if (response.ok) {
                alert('Вопрос успешно добавлен');
                addQuestionForm.reset();
                answerCount = 1;
                // Очищаем контейнер с ответами и оставляем только первый
                answersContainer.innerHTML = `
                    <div class="form-group answer-group">
                        <label>Вариант ответа 1:</label>
                        <input type="text" name="answer1" required>
                        <input type="radio" name="correctAnswer" value="0" required>
                        <label class="radio-label">Правильный ответ</label>
                    </div>
                `;
                loadQuestions();
            } else {
                alert(`Ошибка: ${data.error}`);
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Произошла ошибка при отправке данных');
        }
    });

    // Загрузка существующих вопросов
    async function loadQuestions() {
        try {
            const response = await fetch('/api/questions');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new TypeError("Ответ сервера не в формате JSON");
            }

            const questions = await response.json();
            const questionsList = document.getElementById('questionsList');

            if (!questionsList) {
                console.error('Элемент questionsList не найден');
                return;
            }

            if (!Array.isArray(questions)) {
                questionsList.innerHTML = '<tr><td colspan="3">Нет доступных вопросов</td></tr>';
                return;
            }

            const isMobile = window.innerWidth <= 768;
        
            if (isMobile) {
                questionsList.innerHTML = questions.map((question, index) => {
                    // Проверяем и обрабатываем questionText
                    const questionText = question.questionText || '';
                    const previewText = questionText.length > 50 ? 
                        `${escapeHtml(questionText.substring(0, 50))}...` : 
                        escapeHtml(questionText);

                    return `
                        <tr class="question-row">
                            <td class="question-header" onclick="this.parentElement.classList.toggle('expanded')">
                                <div class="question-summary">
                                    <span class="question-number">${index + 1}.</span>
                                    <span class="question-preview">${previewText}</span>
                                    <i class="fas fa-chevron-down"></i>
                                </div>
                                <div class="question-details">
                                    <div class="full-question">${escapeHtml(questionText)}</div>
                                    <div class="answers-list">
                                        ${Array.isArray(question.answers) ? 
                                            question.answers.map(answer => escapeHtml(answer || '')).join('<br>') : 
                                            ''}
                                    </div>
                                    <div class="action-buttons">
                                        <button class="edit-btn" data-id="${escapeHtml(question._id)}">Редактировать</button>
                                        <button class="delete-btn" data-id="${escapeHtml(question._id)}">Удалить</button>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            } else {
                // Существующий код для десктопной версии
                questionsList.innerHTML = questions.map(question => `
                    <tr>
                        <td>${escapeHtml(question.questionText)}</td>
                        <td>${Array.isArray(question.answers) ? question.answers.map(escapeHtml).join(', ') : ''}</td>
                        <td>
                            <button class="edit-btn" data-id="${escapeHtml(question._id)}">Редактировать</button>
                            <button class="delete-btn" data-id="${escapeHtml(question._id)}">Удалить</button>
                        </td>
                    </tr>
                `).join('');
            }

            // Добавляем обработчики для кнопок
            const deleteButtons = document.querySelectorAll('.delete-btn');
            deleteButtons.forEach(button => {
                button.addEventListener('click', async (e) => {
                    const id = e.target.dataset.id;
                    if (confirm('Вы уверены, что хотите удалить этот вопрос?')) {
                        try {
                            const response = await fetch(`/api/questions/${id}`, {
                                method: 'DELETE'
                            });
                            if (response.ok) {
                                loadQuestions(); // Перезагружаем список
                            } else {
                                alert('Ошибка при удалении вопроса');
                            }
                        } catch (error) {
                            console.error('Ошибка:', error);
                            alert('Ошибка при удалении вопроса');
                        }
                    }
                });
            });
        } catch (error) {
            console.error('Ошибка при загрузке вопросов:', error);
            const questionsList = document.getElementById('questionsList');
            if (questionsList) {
                questionsList.innerHTML = '<tr><td colspan="3">Ошибка при загрузке вопросов</td></tr>';
            }
        }
    }

    // Загружаем вопросы при загрузке страницы
    loadQuestions();
});
