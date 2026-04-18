# VemNaBet â€” Features & Systems

## 1. AutenticaÃ§Ã£o & UsuÃ¡rio
- **Login** â€” email + senha, com modal dedicado
- **Registro** â€” CPF validaÃ§Ã£o em tempo real, nome via API, email, senha, celular
- **SessÃ£o** â€” login persistente via sessionStorage, timer de sessÃ£o ativo
- **RecuperaÃ§Ã£o de senha** â€” fluxo de "esqueci minha senha"
- **Google OAuth** â€” botÃ£o de login social

## 2. Perfil do UsuÃ¡rio (MEU PERFIL)
- **Dados da Conta** â€” email (verificado), celular, CPF (somente leitura), endereÃ§o, contratos
- **Login e SeguranÃ§a** â€” alteraÃ§Ã£o de senha, configuraÃ§Ãµes de 2FA
- **HistÃ³rico de Login** â€” tabela paginada com IP, dispositivo, data/hora
- **Jogo ResponsÃ¡vel** â€” limites de depÃ³sito (diÃ¡rio/semanal/mensal), auto-exclusÃ£o, timeout
- **Foto de perfil** â€” upload, preview, remoÃ§Ã£o

## 3. GestÃ£o de Saldo
- **Carteira** â€” saldo real + saldo bÃ´nus, espelho de saldo no topbar
- **Depositar** â€” modal com PIX (QR code), valores sugeridos, cupom, countdown, status em tempo real
- **Sacar** â€” formulÃ¡rio de saque via PIX (chave PIX), histÃ³rico de saques
- **HistÃ³rico de TransaÃ§Ãµes** â€” tabela com filtros (tipo, status), paginaÃ§Ã£o

## 4. HistÃ³rico de Apostas
- **Apostas de Cassino** â€” listagem filtrada de apostas em jogos de cassino
- **Apostas Esportivas** â€” listagem filtrada de apostas esportivas

## 5. Cassino
- **Jogos** â€” grid de jogos com overlay de play, organizado por provedor
- **Provedores/EstÃºdios** â€” seÃ§Ã£o de cards de estÃºdios (PG Soft, Pragmatic, etc.)
- **Categorias** â€” Ã­cones de categoria (slots, ao vivo, mesa, crash, etc.)
- **Barra de pesquisa** â€” busca global com tags por categoria, resultados em grid
- **Top 10** â€” slider horizontal com ranking de jogos populares
- **PÃ¡gina de jogo** â€” hero, stats, slider de jogos similares, modo demo/real

## 6. Esportes
- **Tab Esportes** â€” switch entre Cassino e Esportes no topbar
- **Ligas** â€” Ã­cones de ligas populares (BrasileirÃ£o, Libertadores, Premier, etc.)
- **Jogos ao Vivo** â€” sidebar com jogos ao vivo
- **E-Sports** â€” categoria dedicada
- **Ãšltimas Apostas** â€” ticker animado com apostas recentes

## 7. PromoÃ§Ãµes & BÃ´nus
- **PrÃªmios e Recompensas** â€” painel com tabs (DisponÃ­veis/Finalizados), filtros (Saldo Real, BÃ´nus, Cashback, Rodadas GrÃ¡tis, Apostas GrÃ¡tis)
- **Faixa de promoÃ§Ãµes** â€” strip horizontal com banners promocionais
- **Cupom de depÃ³sito** â€” campo no modal de depÃ³sito

## 8. Programa de IndicaÃ§Ã£o (INDIQUE E GANHE)
- **Link de referral** â€” gerado por usuÃ¡rio, botÃ£o de copiar e compartilhar
- **Recompensa** â€” R$ 50 por indicaÃ§Ã£o vÃ¡lida
- **Minhas indicaÃ§Ãµes** â€” tabela com filtros de perÃ­odo (total, 90d, 30d, 7d, ontem, hoje)
- **Jogos elegÃ­veis** â€” link para ver jogos que contam para liberaÃ§Ã£o

## 9. NotificaÃ§Ãµes
- **Painel de notificaÃ§Ãµes** â€” listagem com lidas/nÃ£o lidas, badge no topbar e sidebar
- **Marcar todas como lidas** â€” botÃ£o de aÃ§Ã£o em massa
- **Refresh** â€” atualizaÃ§Ã£o manual
- **Banner vazio** â€” estado quando nÃ£o hÃ¡ notificaÃ§Ãµes

## 10. Ganhos Recentes
- **Tabs** â€” Grandes ganhos, Sorte grande, Multiplicadores
- **TrofÃ©u** â€” card especial com imagem e texto
- **Cards de ganhos** â€” carrossel animado com thumb do jogo, usuÃ¡rio, valor ganho

## 11. Tema & PersonalizaÃ§Ã£o
- **Dark/Light theme** â€” toggle no sidebar (wallet-tema) e no dropdown do topbar
- **VariÃ¡veis CSS** â€” cores dinÃ¢micas via CSS custom properties
- **PersistÃªncia** â€” tema salvo em localStorage

## 12. UI/UX
- **Sidebar colapsÃ¡vel** â€” toggle via botÃ£o, tooltip em modo colapsado
- **Bottom nav mobile** â€” 5 itens (InÃ­cio, Buscar, Depositar, PromoÃ§Ãµes, Menu)
- **Sidebar overlay** â€” overlay escuro quando sidebar aberta em mobile
- **Toast notifications** â€” sucesso, erro, info, warning
- **Preloader** â€” barra animada com logo
- **AnimaÃ§Ãµes** â€” transiÃ§Ãµes suaves, hover effects, pulse em botÃµes CTA
- **Responsive** â€” breakpoints 1024, 960, 768, 640, 520, 480, 375px
- **Safe area** â€” suporte a notched devices (iPhone X+)

## 13. Footer
- **Links institucionais** â€” Sobre nÃ³s, Regras, Termos, Privacidade, Jogo ResponsÃ¡vel
- **Redes sociais** â€” Instagram, Facebook, Twitter, Telegram, YouTube
- **Patrocinadores** â€” logotipos de parceiros
- **SEO** â€” texto oculto expansÃ­vel
- **Legal** â€” selo de regulamentaÃ§Ã£o, texto legal do MinistÃ©rio da Fazenda
- **Contato** â€” botÃµes de e-mail e chat ao vivo
- **Badges** â€” selos 18+, PIX, SSL, jogo responsÃ¡vel

## 14. Admin
Painel administrativo completo:
- [x] Dashboard com mÃ©tricas (usuÃ¡rios, receita, apostas, depÃ³sitos, GGR, saques pendentes)
- [x] Gerenciamento de usuÃ¡rios (CRUD, bloqueio com motivo, verificaÃ§Ã£o KYC, ajuste de saldo)
- [x] Gerenciamento de jogos/provedores
- [x] ConfiguraÃ§Ã£o de promoÃ§Ãµes/bÃ´nus
- [x] ConfiguraÃ§Ã£o de saques (aprovaÃ§Ã£o/rejeiÃ§Ã£o manual com reembolso)
- [x] RelatÃ³rios financeiros (receita vs saques, GGR, grÃ¡ficos diÃ¡rios, exportaÃ§Ã£o CSV)
- [x] ConfiguraÃ§Ã£o de limites e jogo responsÃ¡vel (depÃ³sito, aposta, perda, tempo)
- [x] Gerenciamento de indicaÃ§Ãµes (afiliados)
- [x] Sistema de notificaÃ§Ãµes push (global e individual)
- [x] ConfiguraÃ§Ã£o de temas/layout
- [x] Logs de atividade/auditoria
- [x] ConfiguraÃ§Ã£o de ligas/esportes (categorias + ligas CRUD)
- [x] Gerenciamento de cupons (cÃ³digos, validade, limites de uso)
