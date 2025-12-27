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

Після завантаження з GitHub Actions ви побачите два DMG файли:
- `DMarket Bot-0.7.1.dmg` - для Intel Mac (x64)
- `DMarket Bot-0.7.1-arm64.dmg` - для Apple Silicon Mac (M1, M2, M3, тощо)

**Як визначити архітектуру вашого Mac:**

1. Відкрийте "About This Mac" (Про цей Mac):
   - Натисніть на меню Apple (🍎) → "About This Mac"
   - Якщо бачите "Chip: Apple M1" (або M2, M3) - вам потрібен файл з `-arm64`
   - Якщо бачите "Processor: Intel" - вам потрібен файл **БЕЗ** `-arm64`

2. Або через термінал:
```bash
uname -m
```
**Важливо:** Між `uname` та `-m` має бути пробіл!

Результат:
- Якщо виводить `arm64` - використовуйте файл з `-arm64` (для Apple Silicon)
- Якщо виводить `x86_64` - використовуйте файл **БЕЗ** `-arm64` (для Intel)

**⚠️ ЯКЩО ВИ БАЧИТЕ ПОМИЛКУ "цей Mac не підтримує":**

1. **Переконайтеся, що ви використовуєте ПРАВИЛЬНИЙ файл для вашої архітектури:**
   - Для Intel Mac (x86_64) - використовуйте `DMarket Bot-0.7.1.dmg` (БЕЗ `-arm64`)
   - Для Apple Silicon (arm64) - використовуйте `DMarket Bot-0.7.1-arm64.dmg` (З `-arm64`)
   - Якщо використали неправильний файл - завантажте правильний
   
2. **Видаліть старий файл повністю:**
   - Видаліть старий DMG файл
   - Видаліть додаток з папки Applications (якщо встановлено)
   - Очистіть кошик

3. **Завантажте правильний файл** з GitHub Actions після успішної збірки

4. **Перевірте версію macOS:**
   - Потрібна macOS 10.13 (High Sierra) або новіша
   - Ваша версія: macOS 12.7.5 - підтримується ✅

5. **Якщо проблема залишається:**

   **Перевірте архітектуру зібраного додатку:**
   ```bash
   # Після встановлення додатку, перевірте його архітектуру:
   file "/Applications/DMarket Bot.app/Contents/MacOS/DMarket Bot"
   ```
   
   Результат має показувати:
   - Для Intel Mac: `Mach-O 64-bit executable x86_64`
   - Для Apple Silicon: `Mach-O 64-bit executable arm64`
   - Для universal: `Mach-O universal binary with 2 architectures: [x86_64: Mach-O 64-bit executable x86_64] [arm64: Mach-O 64-bit executable arm64]`
   
   Якщо показує тільки `arm64` на Intel Mac - це проблема збірки. Спробуйте:
   - Завантажити файл заново з GitHub Actions
   - Переконайтеся, що використовуєте файл БЕЗ `-arm64` для Intel Mac

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

