# Agendamento online — correção e limites da verificação

Análise baseada no `main` em `bfe3681edb927d2251458019b3fe28eda7166fe7`, com alterações nesta branch. Nenhuma reserva, sessão Stripe ou pagamento de produção foi efetuado.

## Comportamento implementado

- Trocar PT/EN/ES descarta o horário selecionado, oculta os dados e carrega novamente a disponibilidade com o novo idioma. Respostas atrasadas, incluindo erros, não podem alterar o pedido mais recente.
- Carregamento, lista vazia e falha são estados distintos. Falhas têm opção de repetir; o formulário continua bloqueado até à escolha de um horário válido.
- Nome e e-mail são obrigatórios, com espaços exteriores removidos e limites de comprimento. Telefone é opcional, validado quando preenchido e obrigatório quando há consentimento para WhatsApp. Consentimento continua desmarcado por padrão.
- Datas devem ter fuso horário, ser válidas, futuras e ordenadas. O servidor exige a duração configurada por `CONSULT_SLOT_MINUTES` (45 por padrão) e aceita somente PT/EN/ES.
- Durante envio, horário, idioma e dados ficam bloqueados. Conflito `slot_taken` recarrega a agenda e exige uma nova escolha. Rejeições HTTP 4xx permitem corrigir dados; falhas de rede/timeout/5xx ou resposta de reserva inválida deixam o resultado incerto e impedem outra criação automática na mesma página.
- Depois de receber o ID da pré-reserva, uma falha no checkout permite repetir somente o checkout com esse ID. O servidor usa uma chave de idempotência estável para a sessão Stripe de cada reserva; a garantia externa dessa chave depende do Stripe.
- Só é aceite uma URL HTTPS do checkout hospedado em `checkout.stripe.com`. As três chamadas de agendamento têm timeout de 20 segundos. Mensagens não expõem detalhes internos das respostas da API.
- Falhas de consulta da base de dados ou de uma agenda Google configurada não são convertidas em horários livres. A criação reconsulta conflitos do Google Calendar. Serviços inexistentes/inativos/sem preço positivo e reservas não pendentes, inválidas ou passadas não seguem para checkout.

## Confirmado pelo código, sem afirmar estado de produção

| Questão | Evidência e limite |
|---|---|
| Agenda por idioma | `get-availability` usa uma agenda comum para PT/EN/ES. Agora valida o idioma, mas não existe associação entre profissionais/idiomas/horários. O frontend garante que a lista vem do pedido do idioma atual; não demonstra capacidade de atendimento de um profissional nesse idioma. |
| Conflitos de reserva | `create-booking` consulta sobreposições antes de inserir. Não há operação atómica de reservar no código disponível; não foi confirmada uma constraint de exclusão na base de dados publicada. Duas requisições simultâneas ainda dependem dessa proteção. |
| Fuso horário | Os horários apresentados usam o fuso do navegador. A geração das horas comerciais continua baseada no fuso do runtime Deno; `CONSULT_TIMEZONE` é usado pela integração Google para eventos. A correspondência com Europe/Lisbon e mudanças de horário precisa de validação operacional. |
| Google Calendar | Ausência de configuração continua a significar disponibilidade baseada apenas na base de dados. Uma configuração válida, permissões e agenda correta não foram confirmadas. |
| Turnstile | `create-booking` verifica o token quando há `TURNSTILE_SECRET_KEY`. Este formulário não tem widget/token; se a chave estiver ativa, o servidor recusará o envio e a interface mostrará a falha. Não se removeu ou contornou essa proteção. |
| Pré-reservas pendentes | Após falha de checkout a pré-reserva pode continuar pendente e bloquear o horário. A recuperação usa o ID em memória da página; recarregar a página perde essa memória. Não há rotina de expiração geral de pré-reservas comprovada neste repositório. |
| Stripe e notificações | Credenciais, disponibilidade externa, comportamento real da idempotência, webhooks e confirmação final não foram exercitados. |

## Testes reproduzíveis

Na pasta `site`:

```sh
npm ci
npx playwright install chromium
npm test
npx tsc --noEmit
npm run build
```

Os testes Node executam os handlers reais com base de dados, Calendar, Turnstile e Stripe simulados, além dos wrappers da API e do tratamento de falhas do Google. A rede é proibida na suíte dos handlers. Os testes Playwright exercitam o componente Astro real e usam apenas um servidor local e APIs `.invalid`, interceptando todas as chamadas externas, incluindo a navegação para checkout. Nenhum segredo real é necessário.

Cobertura: idiomas iniciais (incluindo página FR → consulta EN), troca de idioma, respostas fora de ordem, vazio/erro/recuperação, timeout, validação dos contactos, horário expirado, consentimento, bloqueio de envio repetido, conflito, rejeição/resultado incerto da reserva, URLs inválidas e recuperação do checkout com o mesmo ID. A workflow `booking-tests.yml` executa testes, TypeScript e build nos pull requests.

## Publicação e verificação posterior

A branch/pull request não publica o site. O merge em `main` aciona a workflow existente de GitHub Pages. Essa workflow publica apenas o frontend; as alterações de `get-availability`, `create-booking` e `create-checkout-session` precisam de deployment separado no projeto Supabase do site, incluindo as dependências `_shared`.

Antes de afirmar que o fluxo está validado em produção, verificar em ambiente de teste: duração da consulta, serviço CONSULT ativo e preço, fuso comercial, atendimento nos três idiomas, configuração do Turnstile, conflitos simultâneos, expiração das pré-reservas e checkout/webhooks com credenciais Stripe de teste. Um modelo de agendas por profissional/idioma exige a configuração real da equipa; não se inventaram regras de disponibilidade.
