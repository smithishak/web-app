document.addEventListener('DOMContentLoaded', () => {
    const usersList = document.getElementById('usersList');
    const addUserForm = document.getElementById('addUserForm');
    
    // Хранилище паролей (временное, в памяти)
    const userPasswords = new Map();
    
    // Генерация случайного пароля
    function generatePassword() {
        const length = 8;
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let password = "";
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return password;
    }

    // Загрузка списка пользователей
    async function loadUsers() {
        try {
            const response = await fetch('/api/users');
            const users = await response.json();
            
            usersList.innerHTML = users.map(user => `
                <tr>
                    <td>${user.username}</td>
                    <td>${user.lastName} ${user.firstName} ${user.middleName || ''}</td>
                    <td>
                        ${userPasswords.get(user._id) || 'Пароль скрыт'}
                        ${userPasswords.get(user._id) ? 
                            `<button onclick="copyPassword('${user._id}')" class="copy-btn">
                                <i class="fas fa-copy"></i>
                            </button>` : ''}
                    </td>
                    <td>
                        <button onclick="editUser('${user._id}')" class="edit-btn">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteUser('${user._id}')" class="delete-btn">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button onclick="resetPassword('${user._id}')" class="reset-btn">
                            <i class="fas fa-key"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
        }
    }

    // Добавляем функцию копирования пароля
    window.copyPassword = (userId) => {
        const password = userPasswords.get(userId);
        if (password) {
            navigator.clipboard.writeText(password)
                .then(() => alert('Пароль скопирован в буфер обмена'))
                .catch(() => alert('Ошибка при копировании пароля'));
        }
    };

    // Добавляем функцию сброса пароля
    window.resetPassword = async (userId) => {
        if (confirm('Сбросить пароль пользователя?')) {
            const newPassword = generatePassword();
            try {
                const response = await fetch(`/api/users/${userId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ password: newPassword })
                });

                if (response.ok) {
                    userPasswords.set(userId, newPassword);
                    alert(`Новый пароль: ${newPassword}`);
                    loadUsers();
                } else {
                    alert('Ошибка при сбросе пароля');
                }
            } catch (error) {
                console.error('Ошибка:', error);
                alert('Ошибка при сбросе пароля');
            }
        }
    };

    // Модифицируем обработчик добавления пользователя
    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = generatePassword();
        
        const userData = {
            username: addUserForm.username.value,
            password: password,
            firstName: addUserForm.firstName.value,
            lastName: addUserForm.lastName.value,
            middleName: addUserForm.middleName.value,
            isAdmin: addUserForm.isAdmin.checked
        };

        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const result = await response.json();
            if (response.ok) {
                userPasswords.set(result.user._id, password);
                alert(`Пользователь создан успешно!\nЛогин: ${userData.username}\nПароль: ${password}`);
                addUserForm.reset();
                loadUsers();
            } else {
                alert('Ошибка при создании пользователя');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при создании пользователя');
        }
    });

    // Функция удаления пользователя
    window.deleteUser = async (userId) => {
        if (confirm('Вы уверены, что хотите удалить этого пользователя?')) {
            try {
                const response = await fetch(`/api/users/${userId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    alert('Пользователь успешно удален');
                    loadUsers(); // Перезагружаем список
                } else {
                    alert('Ошибка при удалении пользователя');
                }
            } catch (error) {
                console.error('Ошибка:', error);
                alert('Ошибка при удалении пользователя');
            }
        }
    };

    // Функция редактирования пользователя
    window.editUser = async (userId) => {
        try {
            const response = await fetch(`/api/users/${userId}`);
            const user = await response.json();
            
            const newData = {
                firstName: prompt('Имя:', user.firstName),
                lastName: prompt('Фамилия:', user.lastName),
                middleName: prompt('Отчество:', user.middleName || ''),
                isAdmin: confirm('Сделать администратором?')
            };

            if (newData.firstName && newData.lastName) {
                const updateResponse = await fetch(`/api/users/${userId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(newData)
                });

                if (updateResponse.ok) {
                    alert('Данные пользователя обновлены');
                    loadUsers(); // Перезагружаем список
                } else {
                    alert('Ошибка при обновлении пользователя');
                }
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при редактировании пользователя');
        }
    };

    // Инициализация
    loadUsers();
});
