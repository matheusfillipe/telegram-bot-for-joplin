# Telegram bot for Joplin

This is a simple telegram bot to retrieve or create notes from Joplin notepad via its Web Clipper service.

## Installation and Usage

- Clone or [download](https://github.com/matheusfillipe/telegram-bot-for-joplin/archive/refs/heads/master.zip) this repo
- `npm install`
- Create a bot with botfather: https://t.me/botfather
- `mv .env.example .env` 
- Edit your telegram bot token and joplin token on the .env file. For
    headless/terminal joplin you can find the joplin token with:
    ```
    sqlite3 ~/.config/joplin/database.sqlite 'select * from settings where key="api.token";'
    ```
- Start joplin desktop app or `joplin --profile ~/.config/joplin/ server start`
- run `node start`
