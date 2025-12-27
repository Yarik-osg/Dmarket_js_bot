# DMarket Bot Desktop Application

Десктопний додаток для автоматизації торгівлі на DMarket з українською локалізацією.

## 📖 Для користувачів

Якщо ви просто хочете використовувати додаток, прочитайте **[Інструкцію для користувачів (README_USER.md)](README_USER.md)** - там все пояснено простими словами.

---

## 👨‍💻 Для розробників

**Як запустити збірку в GitHub Actions:** Дивіться детальні інструкції в [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md)

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

### macOS

#### Якщо ви завантажили готовий додаток з GitHub Actions:

**Важливо: Вибір правильного файлу для вашого Mac**

Після завантаження з GitHub Actions ви побачите один DMG файл:
- `DMarket Bot-0.7.1.dmg` - universal build (працює на Intel та Apple Silicon)

Цей файл працює на всіх Mac, незалежно від архітектури (Intel x64 або Apple Silicon arm64).

**Якщо ви бачите помилку "цей Mac не підтримує":**

1. Переконайтеся, що ви завантажили останню версію з GitHub Actions
2. Спробуйте видалити старий файл і завантажити новий
3. Якщо проблема залишається, перевірте версію macOS (потрібна macOS 10.13 або новіша)

**Рішення проблеми з Gatekeeper (безпека macOS):**

Якщо macOS блокує запуск додатку з повідомленням "не може бути верифікований розробник", виконайте один з наступних кроків:

**Спосіб 1: Через Finder (найпростіший)**
1. Знайдіть завантажений файл `DMarket Bot.dmg` або `DMarket Bot.app`
2. Якщо це `.dmg` файл - відкрийте його та перетягніть додаток в папку Applications
3. Натисніть правою кнопкою миші (або Control+Click) на `DMarket Bot.app`
4. Виберіть "Open" (Відкрити)
5. У діалозі безпеки натисніть "Open" (Відкрити)

**Спосіб 2: Через термінал (якщо додаток вже розпакований)**
```bash
# Якщо додаток в папці Downloads
xattr -dr com.apple.quarantine ~/Downloads/"DMarket Bot.app"

# Або якщо в Applications
xattr -dr com.apple.quarantine /Applications/"DMarket Bot.app"

# Або якщо в поточній папці
xattr -dr com.apple.quarantine "./DMarket Bot.app"
```

**Спосіб 3: Через Системні налаштування**
1. Відкрийте "System Settings" → "Privacy & Security"
2. Прокрутіть вниз до секції "Security"
3. Знайдіть повідомлення про блокування додатку
4. Натисніть "Open Anyway"

#### Якщо ви збираєте додаток самостійно:

**Збірка для macOS:**
```bash
npm run build:mac
```

**Рішення проблеми з Gatekeeper:**

**Спосіб 1: Через скрипт (рекомендовано)**
```bash
chmod +x scripts/mac-allow-app.sh
./scripts/mac-allow-app.sh
```

**Спосіб 2: Вручну через термінал**
```bash
xattr -dr com.apple.quarantine "dist-electron/mac/DMarket Bot.app"
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

