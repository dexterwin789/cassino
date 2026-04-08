# CassinoBet — Features & Systems

## 1. Autenticação & Usuário
- **Login** — email + senha, com modal dedicado
- **Registro** — CPF validação em tempo real, nome via API, email, senha, celular
- **Sessão** — login persistente via sessionStorage, timer de sessão ativo
- **Recuperação de senha** — fluxo de "esqueci minha senha"
- **Google OAuth** — botão de login social

## 2. Perfil do Usuário (MEU PERFIL)
- **Dados da Conta** — email (verificado), celular, CPF (somente leitura), endereço, contratos
- **Login e Segurança** — alteração de senha, configurações de 2FA
- **Histórico de Login** — tabela paginada com IP, dispositivo, data/hora
- **Jogo Responsável** — limites de depósito (diário/semanal/mensal), auto-exclusão, timeout
- **Foto de perfil** — upload, preview, remoção

## 3. Gestão de Saldo
- **Carteira** — saldo real + saldo bônus, espelho de saldo no topbar
- **Depositar** — modal com PIX (QR code), valores sugeridos, cupom, countdown, status em tempo real
- **Sacar** — formulário de saque via PIX (chave PIX), histórico de saques
- **Histórico de Transações** — tabela com filtros (tipo, status), paginação

## 4. Histórico de Apostas
- **Apostas de Cassino** — listagem filtrada de apostas em jogos de cassino
- **Apostas Esportivas** — listagem filtrada de apostas esportivas

## 5. Cassino
- **Jogos** — grid de jogos com overlay de play, organizado por provedor
- **Provedores/Estúdios** — seção de cards de estúdios (PG Soft, Pragmatic, etc.)
- **Categorias** — ícones de categoria (slots, ao vivo, mesa, crash, etc.)
- **Barra de pesquisa** — busca global com tags por categoria, resultados em grid
- **Top 10** — slider horizontal com ranking de jogos populares
- **Página de jogo** — hero, stats, slider de jogos similares, modo demo/real

## 6. Esportes
- **Tab Esportes** — switch entre Cassino e Esportes no topbar
- **Ligas** — ícones de ligas populares (Brasileirão, Libertadores, Premier, etc.)
- **Jogos ao Vivo** — sidebar com jogos ao vivo
- **E-Sports** — categoria dedicada
- **Últimas Apostas** — ticker animado com apostas recentes

## 7. Promoções & Bônus
- **Prêmios e Recompensas** — painel com tabs (Disponíveis/Finalizados), filtros (Saldo Real, Bônus, Cashback, Rodadas Grátis, Apostas Grátis)
- **Faixa de promoções** — strip horizontal com banners promocionais
- **Cupom de depósito** — campo no modal de depósito

## 8. Programa de Indicação (INDIQUE E GANHE)
- **Link de referral** — gerado por usuário, botão de copiar e compartilhar
- **Recompensa** — R$ 50 por indicação válida
- **Minhas indicações** — tabela com filtros de período (total, 90d, 30d, 7d, ontem, hoje)
- **Jogos elegíveis** — link para ver jogos que contam para liberação

## 9. Notificações
- **Painel de notificações** — listagem com lidas/não lidas, badge no topbar e sidebar
- **Marcar todas como lidas** — botão de ação em massa
- **Refresh** — atualização manual
- **Banner vazio** — estado quando não há notificações

## 10. Ganhos Recentes
- **Tabs** — Grandes ganhos, Sorte grande, Multiplicadores
- **Troféu** — card especial com imagem e texto
- **Cards de ganhos** — carrossel animado com thumb do jogo, usuário, valor ganho

## 11. Tema & Personalização
- **Dark/Light theme** — toggle no sidebar (wallet-tema) e no dropdown do topbar
- **Variáveis CSS** — cores dinâmicas via CSS custom properties
- **Persistência** — tema salvo em localStorage

## 12. UI/UX
- **Sidebar colapsável** — toggle via botão, tooltip em modo colapsado
- **Bottom nav mobile** — 5 itens (Início, Buscar, Depositar, Promoções, Menu)
- **Sidebar overlay** — overlay escuro quando sidebar aberta em mobile
- **Toast notifications** — sucesso, erro, info, warning
- **Preloader** — barra animada com logo
- **Animações** — transições suaves, hover effects, pulse em botões CTA
- **Responsive** — breakpoints 1024, 960, 768, 640, 520, 480, 375px
- **Safe area** — suporte a notched devices (iPhone X+)

## 13. Footer
- **Links institucionais** — Sobre nós, Regras, Termos, Privacidade, Jogo Responsável
- **Redes sociais** — Instagram, Facebook, Twitter, Telegram, YouTube
- **Patrocinadores** — logotipos de parceiros
- **SEO** — texto oculto expansível
- **Legal** — selo de regulamentação, texto legal do Ministério da Fazenda
- **Contato** — botões de e-mail e chat ao vivo
- **Badges** — selos 18+, PIX, SSL, jogo responsável

## 14. Admin (futuro)
Áreas planejadas para o painel administrativo:
- [ ] Dashboard com métricas (usuários, receita, apostas, depósitos)
- [ ] Gerenciamento de usuários (CRUD, bloqueio, verificação KYC)
- [ ] Gerenciamento de jogos/provedores
- [ ] Configuração de promoções/bônus
- [ ] Configuração de saques (aprovação manual/automática)
- [ ] Relatórios financeiros
- [ ] Configuração de limites e jogo responsável
- [ ] Gerenciamento de indicações
- [ ] Sistema de notificações push
- [ ] Configuração de temas/layout
- [ ] Logs de atividade/auditoria
- [ ] Configuração de ligas/esportes
- [ ] Gerenciamento de cupons
