# Інструкція зі збірки DMarket Bot

## Передумови

1. Встановлений Node.js (версія 18 або вище)
2. Встановлені всі залежності: `npm install`

## ⚠️ ВАЖЛИВО перед збіркою!

**ОБОВ'ЯЗКОВО видаліть ваші API ключі перед збіркою!**

Ключі зберігаються через electron-store в:
- Windows: `%APPDATA%\dmarket-bot\config.json`
- Або видаліть їх через налаштування в додатку (вийдіть з системи)

**Ключі НЕ повинні бути в .exe файлі** - вони зберігаються окремо для кожного користувача після встановлення.

## Кроки для збірки

### 1. Збірка production версії

Спочатку потрібно зібрати production версію фронтенду:

```bash
npm run build
```

Це створить оптимізовані файли в `renderer/dist/` з вимкненими DevTools.

### 2. Збірка Electron додатку

#### Для Windows:

```bash
npm run build:win
```

#### Для macOS:

```bash
npm run build:mac
```

**⚠️ ВАЖЛИВО для macOS:**
- Збірка для macOS **вимагає macOS машину** (не можна зібрати на Windows/Linux)
- Якщо ви на Windows і спробуєте зібрати macOS версію, ви побачите помилку:
  ```
  ⨯ Build for macOS is supported only on macOS
  ```
- **Рішення:**
  1. **Використайте GitHub Actions** (рекомендовано) - створено автоматичний workflow в `.github/workflows/build.yml`
  2. **Знайдіть когось з Mac** - попросіть зібрати версію на macOS
  3. **Використайте інший CI/CD** - будь-який сервіс з macOS runner (CircleCI, GitLab CI тощо)
- Підтримуються архітектури: x64 (Intel) та arm64 (Apple Silicon)

#### Для поточної платформи:

```bash
npm run dist
```

### 3. Результат

Після успішної збірки ви знайдете:

**Windows:**
- **Installer**: `dist-electron/DMarket Bot Setup 0.7.1.exe`
- **Portable версія** (якщо налаштовано): `dist-electron/DMarket Bot-win32-x64/`

**macOS:**
- **DMG файл**: `dist-electron/DMarket Bot-0.7.1.dmg` (для встановлення)
- **App bundle**: `dist-electron/mac/DMarket Bot.app` (portable версія)

## Що включено в production build:

✅ DevTools **ВИМКНЕНІ** (відкриваються тільки в dev режимі)  
✅ Production режим активний  
✅ Ключі **НЕ включені** (зберігаються окремо для кожного користувача)  
✅ Оптимізований код (minified)

## Альтернативні команди

- `npm run build:electron` - збірка для поточної платформи
- `npm run build:win` - збірка тільки для Windows
- `npm run build:mac` - збірка тільки для macOS
- `npm run build` - тільки збірка фронтенду (без Electron)

## Розподіл додатку

Після збірки ви можете:

**Windows:**
1. Розподілити `.exe` інсталятор користувачам
2. Або розпакувати portable версію з папки `dist-electron/`

**macOS:**
1. Розподілити `.dmg` файл користувачам (вони відкриють його та перетягнуть додаток в Applications)
2. Або розподілити `.app` bundle напряму

**Кожен користувач введе свої власні ключі після встановлення!**

## Примітки

- Перша збірка може зайняти більше часу, оскільки electron-builder завантажує необхідні файли
- Розмір файлів:
  - Windows `.exe`: приблизно 100-150 MB (включає Electron runtime)
  - macOS `.dmg`: приблизно 100-150 MB (включає Electron runtime)
- Для зменшення розміру можна використати electron-builder з налаштуваннями для компресії
- **macOS збірка:** Якщо ви не маєте macOS, розгляньте використання GitHub Actions або іншого CI/CD сервісу з macOS runner

## Автоматична збірка через GitHub Actions

Якщо у вас немає macOS машини, ви можете використати автоматичну збірку через GitHub Actions.

### Як використовувати:

1. **Завантажте код на GitHub** (якщо ще не завантажили)

2. **Запустіть збірку вручну:**
   - Перейдіть в **Actions** на GitHub
   - Виберіть workflow **"Build Desktop App"**
   - Натисніть **"Run workflow"**
   - Виберіть платформу: `win`, `mac` або `all`
   - Натисніть **"Run workflow"**

3. **Або створіть тег для автоматичної збірки:**
   ```bash
   git tag v0.7.1
   git push origin v0.7.1
   ```
   Це автоматично запустить збірку для обох платформ.

4. **Завантажте зібрані файли:**
   - Після завершення збірки перейдіть в **Actions**
   - Відкрийте завершений workflow run
   - В розділі **Artifacts** завантажте:
     - `windows-installer` - для Windows
     - `macos-dmg` - для macOS

### Налаштування workflow:

Workflow файл знаходиться в `.github/workflows/build.yml` і вже налаштований для:
- ✅ Збірки Windows на Windows runner
- ✅ Збірки macOS на macOS runner
- ✅ Автоматичної збірки при створенні тегів (v*)
- ✅ Ручного запуску з вибором платформи

