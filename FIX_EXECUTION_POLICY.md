# Як виправити ExecutionPolicy в PowerShell

## Проблема
PowerShell блокує виконання скриптів через налаштування ExecutionPolicy.

## Рішення

### Варіант 1: Змінити ExecutionPolicy для поточного користувача (рекомендовано)

Відкрийте PowerShell **як Адміністратор** і виконайте:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Це дозволить виконувати локальні скрипти без підпису та завантажені скрипти з підписом.

### Варіант 2: Змінити ExecutionPolicy тільки для поточного сеансу

```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

Це працює тільки для поточного вікна PowerShell.

### Варіант 3: Обійти ExecutionPolicy без змін системи

Використовуйте команди напряму без скриптів:

```powershell
cd D:\dm-trading-tools\dmarket-bot
$env:Path += ";C:\Program Files\nodejs"
& "C:\Program Files\nodejs\npm.cmd" run build
& "C:\Program Files\nodejs\npm.cmd" start
```

## Перевірка поточного ExecutionPolicy

```powershell
Get-ExecutionPolicy
```

## Доступні значення ExecutionPolicy

- **Restricted** - блокує всі скрипти (за замовчуванням)
- **RemoteSigned** - дозволяє локальні скрипти, завантажені потребують підпису
- **Unrestricted** - дозволяє всі скрипти (небезпечно)
- **Bypass** - ігнорує всі обмеження (небезпечно)

## Рекомендація

Використовуйте **RemoteSigned** для поточного користувача - це безпечно і дозволить виконувати ваші локальні скрипти.

