document.addEventListener('DOMContentLoaded', function() {
    const addTestForm = document.getElementById('addTestForm');
    const testsList = document.getElementById('testsList');

    // Обновляем функцию загрузки тестов с обработкой ошибок
    async function loadTests() {
        try {
            console.log('Загружаем список тестов...');
            const response = await fetch('/api/tests');
            console.log('Статус ответа получения тестов:', response.status);
            
            const tests = await response.json();
            console.log('Получены тесты:', tests);

            if (!Array.isArray(tests)) {
                console.log('Получен неверный формат данных');
                testsList.innerHTML = '<div class="no-tests">Нет доступных тестов</div>';
                return;
            }
            
            testsList.innerHTML = tests.map(test => `
                <div class="test-card" data-test-id="${test._id}">
                    <div class="test-header">
                        <h3 class="test-title">${escapeHtml(test.title)}</h3>
                        <div class="test-actions">
                            <button class="edit-test-btn" title="Редактировать">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="delete-test-btn" title="Удалить">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="test-description">${escapeHtml(test.description || '')}</div>
                    <div class="test-questions">
                        <h4>Вопросы (${test.questions ? test.questions.length : 0}):</h4>
                        ${test.questions ? test.questions.map(q => `
                            <div class="question-item">
                                ${escapeHtml(q.questionText || '')}
                            </div>
                        `).join('') : ''}
                    </div>
                </div>
            `).join('');

            // Добавляем обработчики для кнопок удаления и редактирования
            addTestButtonHandlers();
        } catch (error) {
            console.error('Ошибка при загрузке тестов:', error);
            testsList.innerHTML = '<div class="error-message">Ошибка при загрузке тестов</div>';
        }
    }

    // Обновляем обработчик создания теста
    addTestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addTestForm);
        
        const testData = {
            title: formData.get('testTitle'),
            description: formData.get('testDescription')
        };

        console.log('Отправляем данные теста:', testData);
        
        try {
            const response = await fetch('/api/tests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(testData)
            });

            console.log('Статус ответа:', response.status);
            const data = await response.json();
            console.log('Ответ сервера:', data);

            if (response.ok) {
                alert('Тест успешно создан');
                addTestForm.reset();
                await loadTests(); // Перезагружаем список тестов
            } else {
                throw new Error(data.error || 'Ошибка при создании теста');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert(error.message || 'Ошибка при создании теста');
        }
    });

    function addTestButtonHandlers() {
        // Обработчик удаления теста
        document.querySelectorAll('.delete-test-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const testCard = e.target.closest('.test-card');
                const testId = testCard.dataset.testId;
                
                if (confirm('Вы уверены, что хотите удалить этот тест?')) {
                    try {
                        const response = await fetch(`/api/tests/${testId}`, {
                            method: 'DELETE'
                        });
                        
                        if (response.ok) {
                            testCard.remove();
                        } else {
                            throw new Error('Ошибка при удалении теста');
                        }
                    } catch (error) {
                        console.error('Ошибка:', error);
                        alert('Ошибка при удалении теста');
                    }
                }
            });
        });
    }

    // Инициализация при загрузке страницы
    loadTests();
});
