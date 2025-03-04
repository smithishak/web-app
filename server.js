// Импорт необходимых модулей
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const User = require('./models/user');
const { ObjectId } = require('mongodb');
const fs = require('fs');
const Test = require('./models/test');

// Подключение к MongoDB
mongoose.connect('mongodb://localhost:27017/web-app-db', { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
})
.then(() => console.log('MongoDB подключен успешно'))
.catch(err => console.error('Ошибка подключения к MongoDB:', err));

const db = mongoose.connection;
let questionsCollection;
let testsCollection; // Добавляем переменную для коллекции тестов

db.once('open', async () => {
    questionsCollection = db.collection('questions');
    testsCollection = db.collection('tests'); // Инициализируем коллекцию тестов
    console.log('Коллекции questions и tests инициализированы');
});

// Инициализация Express приложения
const app = express();

// Middleware для обработки JSON данных и статических файлов
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Обновляем middleware проверки админа
const checkAdmin = async (req, res, next) => {
    try {
        const user = await User.findOne({ username: 'admin' });
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        next();
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Маршрут для авторизации
app.post('/auth', async (req, res) => {
    const { login, password } = req.body;
    try {
        const user = await User.findOne({ username: login });
        
        if (!user || user.password !== password) {
            return res.status(401).json({ 
                success: false, 
                message: 'Неверный логин или пароль' 
            });
        }
        
        // Обновляем время последнего входа
        await User.findByIdAndUpdate(user._id, {
            lastLoginDate: new Date()
        });
        
        res.json({ 
            success: true,
            username: user.username,
            isAdmin: user.isAdmin
        });
    } catch (error) {
        console.error('Ошибка авторизации:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Ошибка сервера' 
        });
    }
});

// Protected admin routes
app.get('/api/check-admin', checkAdmin, (req, res) => {
    res.json({ success: true });
});

// Защищенный маршрут для админ-панели
app.get('/admin-panel.html', checkAdmin, (req, res, next) => {
    res.sendFile(path.join(__dirname, 'admin-panel.html'));
});

// Добавляем защиту для страниц управления
app.get('/views/users-management.html', checkAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views/users-management.html'));
});

app.get('/views/questions-management.html', checkAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views/questions-management.html'));
});

// Добавляем маршрут для проверки статуса подключения к БД
app.get('/api/db-status', (req, res) => {
    res.json({ 
        connected: !!questionsCollection,
        dbStatus: mongoose.connection.readyState
    });
});

// API маршруты для пользователей
app.get('/api/users', checkAdmin, async (req, res) => {
    try {
        const users = await User.find({}, '-password');
        res.json(users);
    } catch (error) {
        console.error('Ошибка получения пользователей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/users', checkAdmin, async (req, res) => {
    try {
        const userData = req.body;
        const newUser = new User(userData);
        await newUser.save();
        res.status(201).json({
            success: true,
            user: {
                ...userData,
                password: undefined // Не отправляем пароль обратно
            }
        });
    } catch (error) {
        console.error('Ошибка создания пользователя:', error);
        if (error.code === 11000) { // Ошибка дубликата
            res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
        } else {
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    }
});

app.delete('/api/users/:id', checkAdmin, async (req, res) => {
    try {
        const result = await User.findByIdAndDelete(req.params.id);
        if (!result) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка удаления пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.put('/api/users/:id', checkAdmin, async (req, res) => {
    try {
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, select: '-password' }
        );
        if (!updatedUser) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        res.json(updatedUser);
    } catch (error) {
        console.error('Ошибка обновления пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Добавляем маршрут для получения данных пользователя
app.get('/api/users/:id', checkAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        res.json(user);
    } catch (error) {
        console.error('Ошибка получения пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновленные endpoints для вопросов с проверкой инициализации
app.post('/api/questions', async (req, res) => {
    if (!questionsCollection) {
        return res.status(500).json({ error: 'База данных не инициализирована' });
    }
    try {
        const { testId, questionText, answers, correctAnswer } = req.body;

        // Проверяем существование теста
        const test = await Test.findById(testId);
        if (!test) {
            return res.status(404).json({ error: 'Тест не найден' });
        }

        // Создаем новый вопрос
        const questionData = { questionText, answers, correctAnswer };
        const result = await questionsCollection.insertOne(questionData);
        
        // Добавляем вопрос к тесту
        await Test.findByIdAndUpdate(testId, {
            $push: { questions: result.insertedId }
        });

        res.json({ 
            success: true, 
            id: result.insertedId 
        });
    } catch (error) {
        console.error('Ошибка при добавлении вопроса:', error);
        res.status(500).json({ error: 'Ошибка при добавлении вопроса' });
    }
});

app.get('/api/questions', async (req, res) => {
    try {
        if (!questionsCollection) {
            throw new Error('База данных не инициализирована');
        }
        const questions = await questionsCollection.find({}).toArray();
        
        // Фильтруем некорректные записи
        const validQuestions = questions.filter(q => 
            q && 
            typeof q.questionText === 'string' && 
            Array.isArray(q.answers) &&
            typeof q.correctAnswer === 'number'
        );

        res.setHeader('Content-Type', 'application/json');
        res.json(validQuestions || []);
    } catch (error) {
        console.error('Ошибка при получении вопросов:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/questions/:id', async (req, res) => {
    try {
        const result = await questionsCollection.deleteOne({
            _id: new ObjectId(req.params.id)
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка при удалении вопроса:', error);
        res.status(500).json({ error: 'Ошибка при удалении вопроса' });
    }
});

// Маршрут для получения вопросов пользователями (без правильных ответов)
app.get('/api/questions/public', async (req, res) => {
    try {
        if (!questionsCollection) {
            throw new Error('База данных не инициализирована');
        }
        const questions = await questionsCollection.find({}).toArray();
        // Удаляем информацию о правильных ответах перед отправкой
        const publicQuestions = questions.map(({ questionText, answers, _id }) => ({
            _id,
            questionText,
            answers
        }));
        res.json(publicQuestions);
    } catch (error) {
        console.error('Ошибка при получении вопросов:', error);
        res.status(500).json({ error: error.message });
    }
});

// Добавляем endpoint для получения вопросов конкретного теста
app.get('/api/tests/:testId/questions', async (req, res) => {
    try {
        const test = await Test.findById(req.params.testId);
        if (!test) {
            return res.status(404).json({ error: 'Тест не найден' });
        }

        const questions = await questionsCollection
            .find({
                _id: { $in: test.questions }
            })
            .toArray();

        res.json(questions);
    } catch (error) {
        console.error('Ошибка при получении вопросов теста:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновляем API endpoints для тестов
app.post('/api/tests', checkAdmin, async (req, res) => {
    if (!testsCollection) {
        console.error('Коллекция тестов не инициализирована');
        return res.status(500).json({ error: 'База данных не инициализирована' });
    }
    try {
        console.log('Получены данные для создания теста:', req.body);
        const { title, description } = req.body;
        
        if (!title) {
            console.error('Отсутствует обязательное поле title');
            return res.status(400).json({ error: 'Название теста обязательно' });
        }

        const newTest = {
            title,
            description: description || '',
            questions: [],
            isActive: true,
            createdAt: new Date()
        };

        console.log('Создаем новый тест:', newTest);
        const result = await testsCollection.insertOne(newTest);
        console.log('Тест создан, ID:', result.insertedId);

        res.status(201).json({
            success: true,
            test: { ...newTest, _id: result.insertedId }
        });
    } catch (error) {
        console.error('Ошибка создания теста:', error);
        res.status(500).json({ error: 'Ошибка при создании теста', details: error.message });
    }
});

app.get('/api/tests', async (req, res) => {
    if (!testsCollection) {
        return res.status(500).json({ error: 'База данных не инициализирована' });
    }
    try {
        const tests = await testsCollection.find({}).toArray();
        // Добавляем информацию о вопросах для каждого теста
        const testsWithQuestions = await Promise.all(tests.map(async (test) => {
            if (test.questions && test.questions.length > 0) {
                const questions = await questionsCollection
                    .find({ _id: { $in: test.questions.map(id => new ObjectId(id)) } })
                    .toArray();
                return { ...test, questions };
            }
            return { ...test, questions: [] };
        }));
        res.json(testsWithQuestions);
    } catch (error) {
        console.error('Ошибка получения тестов:', error);
        res.status(500).json({ error: 'Ошибка при получении тестов' });
    }
});

app.delete('/api/tests/:id', checkAdmin, async (req, res) => {
    if (!testsCollection) {
        return res.status(500).json({ error: 'База данных не инициализирована' });
    }
    try {
        const result = await testsCollection.deleteOne({
            _id: new ObjectId(req.params.id)
        });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Тест не найден' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Ошибка удаления теста:', error);
        res.status(500).json({ error: 'Ошибка при удалении теста' });
    }
});

app.put('/api/tests/:id', checkAdmin, async (req, res) => {
    if (!testsCollection) {
        return res.status(500).json({ error: 'База данных не инициализирована' });
    }
    try {
        const { title, description, isActive } = req.body;
        const result = await testsCollection.findOneAndUpdate(
            { _id: new ObjectId(req.params.id) },
            { $set: { title, description, isActive } },
            { returnDocument: 'after' }
        );
        if (!result.value) {
            return res.status(404).json({ error: 'Тест не найден' });
        }
        res.json(result.value);
    } catch (error) {
        console.error('Ошибка обновления теста:', error);
        res.status(500).json({ error: 'Ошибка при обновлении теста' });
    }
});

// Добавляем endpoint для получения конкретного теста
app.get('/api/tests/:id', async (req, res) => {
    try {
        const test = await testsCollection.findOne({
            _id: new ObjectId(req.params.id)
        });

        if (!test) {
            return res.status(404).json({ error: 'Тест не найден' });
        }

        // Получаем вопросы теста
        const questions = await questionsCollection
            .find({ _id: { $in: test.questions.map(id => new ObjectId(id)) } })
            .toArray();

        res.json({
            ...test,
            questions
        });
    } catch (error) {
        console.error('Ошибка при получении теста:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Маршруты для статистики
app.get('/api/admin/statistics/users', checkAdmin, async (req, res) => {
    try {
        // Получаем общее количество пользователей
        const totalUsers = await User.countDocuments();

        // Получаем количество активных пользователей за последние 24 часа
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const activeUsers = await User.countDocuments({
            lastLoginDate: { $gte: oneDayAgo }
        });

        res.json({
            totalUsers,
            activeUsers
        });
    } catch (error) {
        console.error('Ошибка при получении статистики пользователей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Маршрут для получения статистики тестов
app.get('/api/admin/statistics/tests', checkAdmin, async (req, res) => {
    try {
        // Получаем общее количество вопросов
        const totalQuestions = await questionsCollection.countDocuments();

        // Получаем количество завершённых тестов
        const completedTests = await db.collection('test_results').countDocuments({
            completed: true
        });

        res.json({
            totalQuestions,
            completedTests
        });
    } catch (error) {
        console.error('Ошибка при получении статистики тестов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Маршрут для создания резервной копии
app.post('/api/admin/backup', checkAdmin, async (req, res) => {
    try {
        // Получаем все коллекции
        const collections = {
            users: await User.find({}).lean(),
            questions: await questionsCollection.find({}).toArray(),
            test_results: await db.collection('test_results').find({}).toArray()
        };

        // Создаем дату для имени файла
        const date = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(__dirname, 'backups', `backup-${date}.json`);

        // Создаем директорию для бэкапов, если её нет
        if (!fs.existsSync(path.join(__dirname, 'backups'))) {
            fs.mkdirSync(path.join(__dirname, 'backups'));
        }

        // Записываем данные в файл
        fs.writeFileSync(backupPath, JSON.stringify(collections, null, 2));

        res.json({
            success: true,
            message: 'Резервная копия успешно создана',
            filename: `backup-${date}.json`
        });
    } catch (error) {
        console.error('Ошибка при создании резервной копии:', error);
        res.status(500).json({ error: 'Ошибка при создании резервной копии' });
    }
});

// Запуск сервера
app.listen(3000, () => {
    console.log('Сервер запущен на порту 3000');
});
