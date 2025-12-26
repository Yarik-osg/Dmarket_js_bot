# Як виправити ExecutionPolicy

## Важливо! 

Команду `Set-ExecutionPolicy` потрібно виконувати в **PowerShell**, а не в Command Prompt (cmd)!

## Крок 1: Відкрийте PowerShell

1. Натисніть `Win + X` або клацніть правою кнопкою на кнопку "Пуск"
2. Виберіть **"Windows PowerShell (Адміністратор)"** або **"Terminal (Адміністратор)"**
3. Якщо з'явиться запит UAC - натисніть "Так"

## Крок 2: Виконайте команду

В PowerShell виконайте:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Якщо з'явиться запит підтвердження - введіть `Y` (Yes) і натисніть Enter.

## Крок 3: Перевірте

```powershell
Get-ExecutionPolicy
```

Має показати `RemoteSigned`.

## Альтернатива: Без змін системи

Якщо не хочете змінювати налаштування, використовуйте команди напряму:

```powershell
cd D:\dm-trading-tools\dmarket-bot
$env:Path += ";C:\Program Files\nodejs"
& "C:\Program Files\nodejs\npm.cmd" run build
& "C:\Program Files\nodejs\npm.cmd" start
```

## Як відрізнити PowerShell від cmd?

- **PowerShell**: синій фон, промпт `PS C:\>`
- **Command Prompt**: чорний фон, промпт `C:\>`

