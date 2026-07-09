# Deployment auf dem Linux-Root-Server

Anleitung für Ubuntu/Debian. Alle Befehle als root (oder mit `sudo`).
Platzhalter: `<DOMAIN>` = deine Domain, `<DATENBANK>` = Name der MC-Datenbank.

## 1. Node.js 22 LTS installieren

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git nginx
node -v   # sollte v22.x zeigen
```

## 2. MySQL vorbereiten

`setup.sql` auf dem MySQL-Server ausführen (vorher `<DATENBANK>` und
`<PASSWORT>` ersetzen):

```bash
mysql -u root -p < setup.sql
```

Das legt die Login-Code-Tabelle und den eingeschränkten Web-User an
(nur lesen + Login-Tabelle schreiben).

## 3. Projekt klonen und bauen

```bash
mkdir -p /opt && cd /opt
git clone https://github.com/Tryus-Fnr/TryCityWeb.git trycityweb
cd trycityweb
npm ci
```

`.env` anlegen (NICHT committen – die Datei bleibt nur auf dem Server):

```bash
cp .env.example .env
nano .env
# DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD eintragen
# AUTH_SECRET erzeugen mit:  openssl rand -base64 48
```

Bauen:

```bash
npm run build
```

## 4. systemd-Service

`/etc/systemd/system/trycityweb.service`:

```ini
[Unit]
Description=TryCity Website (Next.js)
After=network.target mysql.service

[Service]
Type=simple
WorkingDirectory=/opt/trycityweb
ExecStart=/usr/bin/npm start -- --port 3000
Restart=always
RestartSec=5
Environment=NODE_ENV=production
# .env wird von Next.js automatisch aus dem WorkingDirectory geladen

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now trycityweb
systemctl status trycityweb     # muss "active (running)" zeigen
curl -I http://127.0.0.1:3000   # muss HTTP 200 liefern
```

## 5. nginx als Reverse Proxy

`/etc/nginx/sites-available/trycityweb`:

```nginx
server {
    listen 80;
    server_name <DOMAIN>;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
ln -s /etc/nginx/sites-available/trycityweb /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

## 6. HTTPS mit Let's Encrypt

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d <DOMAIN>
```

Certbot passt die nginx-Config automatisch an und erneuert das Zertifikat
selbstständig.

## 7. Updates einspielen

```bash
cd /opt/trycityweb
git pull
npm ci
npm run build
systemctl restart trycityweb
```

## Wichtig

- Der Ingame-Login funktioniert nur, wenn das SMPGlobal-Plugin mit dem
  Web-Login-Modul auf den Minecraft-Servern läuft (stellt die Codes ingame zu).
- Die Website braucht Netzwerkzugriff auf den MySQL-Server. Läuft MySQL auf
  einem anderen Host, in `setup.sql` statt `'localhost'` den Web-Server-Host
  eintragen und `DB_HOST` entsprechend setzen.
- Passwörter und `AUTH_SECRET` stehen NUR in der `.env` auf dem Server.
