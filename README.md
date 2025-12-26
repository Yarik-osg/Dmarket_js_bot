# DMarket Bot Desktop Application

Десктопний додаток для автоматизації торгівлі на DMarket з українською локалізацією.

## 📖 Для користувачів

Якщо ви просто хочете використовувати додаток, прочитайте **[Інструкцію для користувачів (README_USER.md)](README_USER.md)** - там все пояснено простими словами.

---

## 👨‍💻 Для розробників

## Функціональність

- **Авторизація**: Введення та збереження API ключів DMarket
- **Управління таргетами**: Створення, редагування, видалення таргетів
- **Автоматичне ціноутворення**: Розрахунок оптимальних цін на основі ринкових даних
- **Управління пропозиціями**: Перегляд та оновлення пропозицій на продаж
- **Вибір флоата та фази**: Налаштування параметрів предметів
- **Українська локалізація**: Повна підтримка української мови

## Встановлення

1. Встановіть Node.js (версія 18+)
2. Встановіть залежності:
```bash
npm install
```

## Запуск

### Windows (PowerShell)

**Спосіб 1: Через скрипт (рекомендовано)**

**Продакшн режим:**
```powershell
cd D:\dm-trading-tools\dmarket-bot
.\start.ps1
```

**Режим розробки (з hot reload):**
```powershell
cd D:\dm-trading-tools\dmarket-bot
.\dev.ps1
```

**Спосіб 2: Вручну через npm.cmd**

```powershell
cd D:\dm-trading-tools\dmarket-bot
$env:Path += ";C:\Program Files\nodejs"
& "C:\Program Files\nodejs\npm.cmd" run build
& "C:\Program Files\nodejs\npm.cmd" start
```

**Спосіб 3: Через npm (якщо працює без ExecutionPolicy)**

```powershell
cd D:\dm-trading-tools\dmarket-bot
$env:Path += ";C:\Program Files\nodejs"
npm run build
npm start
```

### Запуск через npm

**Режим розробки:**
В одному терміналі:
```bash
npm run dev
```
В іншому терміналі:
```bash
npm start
```

**Збірка для продакшн:**
```bash
npm run build
npm start
```

## Структура проєкту

- `main/` - Electron main process
- `renderer/src/` - React додаток
  - `components/` - React компоненти
  - `contexts/` - React Contexts
  - `hooks/` - Custom hooks
  - `services/` - API сервіси
  - `locales/` - Локалізація
  - `styles/` - Стилі

## API Endpoints

Додаток використовує DMarket API:
- `GET /marketplace-api/v1/targets-by-title/{game_id}/{title}` - отримання таргетів
- `POST /marketplace-api/v1/target/create` - створення таргета
- `PUT /marketplace-api/v1/target/update` - оновлення таргета
- `DELETE /marketplace-api/v1/target/delete` - видалення таргета
- `GET /exchange/v1/market/items` - пошук предметів
- `GET /trade-aggregator/v1/last-sales` - останні продажі

## Технології

- Electron
- React 18+
- Webpack
- Babel
- electron-store

