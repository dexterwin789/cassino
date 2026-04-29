# JSESSIONID Poller — VemNaBet

Mantém o histórico ao vivo das roletas Pragmatic (Fortune & French) sem proxy pago.

## Por quê?

O servidor do Railway está sendo bloqueado (HTTP 451) na cadeia de launch
do PlayFivers. Esse poller roda **na sua máquina** (IP brasileiro normal),
faz o login na cadeia PlayFivers → Pragmatic, extrai a `JSESSIONID` e envia
ao backend. O backend usa essa sessão para baixar o histórico real.

## Setup (uma vez)

1. **Copie o `.env.example` para `.env`** dentro da pasta `tools/`:
   ```powershell
   cd c:\xampp\htdocs\cassino\tools
   copy .env.example .env
   ```

2. **Gere um token aleatório** para `INGEST_TOKEN`:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Cole o valor em `tools/.env` na linha `INGEST_TOKEN=...`.

3. **Configure o backend (Railway)** com o MESMO token:
   ```powershell
   cd c:\xampp\htdocs\cassino
   railway variables --set "INGEST_TOKEN=COLE_O_MESMO_TOKEN_AQUI"
   ```

4. **Preencha as credenciais PlayFivers** no `.env`
   (`PLAYFIVERS_AGENT_TOKEN` e `PLAYFIVERS_SECRET_KEY` — pegue dos vars do Railway).

## Rodar

Clique 2x em `jsession-poller.bat` ou rode no terminal:
```powershell
node tools\jsession-poller.js
```

Saída esperada:
```
[POLLER] iniciado. backend=https://vemnabet.bet interval=60000ms ...
[2026-04-29...] Fortune Roulette: renewed count=120 Sessão salva e histórico sincronizado.
[2026-04-29...] French Roulette: renewed count=120 Sessão salva e histórico sincronizado.
[2026-04-29...] Fortune Roulette: skip 60s
[2026-04-29...] French Roulette: skip 60s
```

Enquanto estiver rodando, o app puxa histórico real. Se você fechar, o app
cai automaticamente para o modo `operational` (sintético).

## Rodar 24/7 como serviço Windows (opcional)

Use [NSSM](https://nssm.cc):
```powershell
nssm install VemNaBetPoller "C:\Program Files\nodejs\node.exe" "c:\xampp\htdocs\cassino\tools\jsession-poller.js"
nssm set VemNaBetPoller AppDirectory "c:\xampp\htdocs\cassino"
nssm start VemNaBetPoller
```

## Usar proxy no futuro

Defina `OUTBOUND_PROXY` no `.env` no formato `http://user:pass@host:port`.
O poller roteia todas as chamadas pelo proxy automaticamente.
Requer: `npm install https-proxy-agent` (já presente no projeto).

## Variáveis de ajuste

| Variável | Default | Descrição |
|---|---|---|
| `POLL_INTERVAL_MS` | 60000 | Loop entre verificações |
| `RENEW_AFTER_MS` | 720000 (12 min) | Quando forçar renovação da JSESSIONID |
