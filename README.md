# מערכת ניהול פרוקסי

Express.js + React + SQLite

## התקנה מקומית

```bash
# Server
cd server && npm install && npm run dev

# Client (בטרמינל נפרד)
cd client && npm install && npm run dev
```

## Docker

```bash
docker compose up -d --build
```

## משתני סביבה

צור קובץ `.env`:

```
JWT_SECRET=your-secret-key
ADMIN_EMAIL=office@neriyabudraham.co.il
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password
CLIENT_URL=https://proxy.botomat.co.il
```
