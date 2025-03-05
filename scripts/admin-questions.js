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
            testId: formData.get('testId'),  // Добавить testId
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
            const response = await fetch('/api/questions', {  // Изменен путь
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
            const response = await fetch('/api/questions');  // Изменен путь
            questions = await response.json(); // Сохраняем все вопросы
            updateQuestionsList(questions);
        } catch (error) {
            console.error('Ошибка при загрузке вопросов:', error);
            const questionsList = document.getElementById('questionsList');
            if (questionsList) {
                questionsList.innerHTML = '<tr><td colspan="3">Ошибка при загрузке вопросов</td></tr>';
            }
        }
    }

    // Заменяем функцию загрузки тестов для select
    async function loadTests() {
        try {
            const response = await fetch('/api/tests');
            tests = await response.json(); // Сохраняем в глобальную переменную tests

            // Обновляем select для создания вопросов
            const testSelect = document.querySelector('select[name="testId"]');
            if (testSelect) {
                testSelect.innerHTML = '<option value="">Выберите тест</option>';
                tests.forEach(test => {
                    testSelect.innerHTML += `
                        <option value="${escapeHtml(test._id)}">
                            ${escapeHtml(test.title)}
                        </option>
                    `;
                });
            }

            // Обновляем список тестов
            updateTestsList(tests);
        } catch (err) {
            console.error("Ошибка при загрузке тестов:", err);
            alert('Ошибка при загрузке списка тестов');
        }
    }

    // Добавляем обработчики поиска
    const questionSearch = document.getElementById('questionSearch');
    const questionFilter = document.getElementById('questionFilter');
    const testSearch = document.getElementById('testSearch');
    const testFilter = document.getElementById('testFilter');

    let questions = [];
    let tests = [];

    // Функция фильтрации вопросов
    function filterQuestions() {
        const searchQuery = questionSearch.value.toLowerCase();
        const filterValue = questionFilter.value;

        const filteredQuestions = questions.filter(question => {
            const matchesSearch = question.questionText.toLowerCase().includes(searchQuery);
            const matchesFilter = filterValue === 'all' || 
                (filterValue === 'active' && question.isActive) ||
                (filterValue === 'inactive' && !question.isActive);
            
            return matchesSearch && matchesFilter;
        });

        updateQuestionsList(filteredQuestions);
    }

    // Обновляем функцию фильтрации тестов
    function filterTests() {
        const searchQuery = testSearch.value.toLowerCase();
        const filterValue = testFilter.value;

        console.log('Поисковый запрос:', searchQuery); // Для отладки
        console.log('Всего тестов:', tests.length); // Для отладки

        const filteredTests = tests.filter(test => {
            const matchesSearch = test.title.toLowerCase().includes(searchQuery);
            const matchesFilter = filterValue === 'all' || 
                (filterValue === 'active' && test.isActive) ||
                (filterValue === 'inactive' && !test.isActive);
            
            return matchesSearch && matchesFilter;
        });

        console.log('Найдено тестов:', filteredTests.length); // Для отладки
        updateTestsList(filteredTests);
    }

    function updateQuestionsList(filteredQuestions) {
        const questionsList = document.getElementById('questionsList');
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
            // Мобильная версия списка вопросов
            questionsList.innerHTML = filteredQuestions.map((question, index) => `
                <tr class="question-row">
                    <td>
                        <div class="question-header" onclick="this.nextElementSibling.classList.toggle('show')">
                            <div class="question-summary">
                                <span class="question-number">${index + 1}</span>
                                <span class="question-preview">${question.questionText.length > 50 ? 
                                    `${escapeHtml(question.questionText.substring(0, 50))}...` : 
                                    escapeHtml(question.questionText)}</span>
                                <i class="fas fa-chevron-down"></i>
                            </div>
                        </div>
                        <div class="question-details">
                            <div class="full-question">${escapeHtml(question.questionText)}</div>
                            <div class="answers-list">
                                ${Array.isArray(question.answers) ? 
                                    question.answers.map(answer => `<span>${escapeHtml(answer || '')}</span>`).join('') : 
                                    ''}
                            </div>
                            <div class="action-buttons">
                                <button class="icon-btn edit-btn" data-id="${escapeHtml(question._id)}">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="icon-btn delete-btn" data-id="${escapeHtml(question._id)}">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </td>
                </tr>
            `).join('');
        } else {
            // Десктопная версия списка вопросов
            questionsList.innerHTML = filteredQuestions.map(question => `
                <tr>
                    <td>${escapeHtml(question.questionText)}</td>
                    <td>${Array.isArray(question.answers) ? question.answers.map(escapeHtml).join(', ') : ''}</td>
                    <td class="action-buttons">
                        <button class="icon-btn edit-btn" title="Редактировать" data-id="${escapeHtml(question._id)}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="icon-btn delete-btn" title="Удалить" data-id="${escapeHtml(question._id)}">
                            <i class="fas fa-trash"></i>
                        </button>
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
                        const response = await fetch(`/api/questions/${id}`, {  // Изменен путь
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
    }

    // Обновляем функцию updateTestsList
    function updateTestsList(filteredTests) {
        const testsList = document.getElementById('testsList');
        if (!testsList) return;

        testsList.innerHTML = filteredTests.map(test => `
            <div class="test-card" data-test-id="${escapeHtml(test._id)}">
                <h3>${escapeHtml(test.title)}</h3>
                <p>${escapeHtml(test.description || '')}</p>
                <div class="test-questions">
                    <span>Вопросов: ${test.questions ? test.questions.length : 0}</span>
                </div>
                <div class="action-buttons">
                    <button class="icon-btn edit-btn" data-id="${escapeHtml(test._id)}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="icon-btn delete-btn" data-id="${escapeHtml(test._id)}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Добавляем слушатели событий для поиска
    questionSearch.addEventListener('input', filterQuestions);
    questionFilter.addEventListener('change', filterQuestions);
    testSearch.addEventListener('input', filterTests);
    testFilter.addEventListener('change', filterTests);

    // Загружаем данные при загрузке страницы
    loadQuestions();
    loadTests();
});
