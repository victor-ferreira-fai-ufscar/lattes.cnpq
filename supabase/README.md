# 🗄️ Supabase - Backend as a Service

Esta pasta contém todas as configurações e migrações relacionadas ao Supabase, nosso BaaS (Backend as a Service) para o projeto Lattes Automator AI.

## 📋 Sobre o Supabase

O Supabase é uma alternativa open-source ao Firebase, oferecendo:
- **Banco de dados PostgreSQL** gerenciado
- **Autenticação** pronta para uso
- **API REST automática** para tabelas
- **Real-time subscriptions**
- **Storage** para arquivos
- **Edge Functions** (equivalente a Cloud Functions)

## 🚀 Planejamento

### Funcionalidades Planejadas
- **Autenticação de usuários** (institucional e individual)
- **Histórico de buscas** por usuário
- **Cache inteligente** de currículos processados
- **Dashboard analítico** de uso
- **Rate limiting** por usuário/organização
- **Logs de auditoria** das operações

### Estrutura do Banco (Prevista)

```sql
-- Usuários e organizações
users
organizations
user_organization_memberships

-- Dados do Lattes
lattes_profiles
lattes_searches
lattes_documents

-- Analytics e auditoria
search_logs
api_usage
audit_logs
```

## 🛠️ Configuração

### Conta Institucional
- **Email**: victor.ferreira@fai.ufscar.br
- **Organização**: FAI-UFSCar
- **Projeto**: lattes-automator-ai

### Variáveis de Ambiente
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 📁 Estrutura Planejada

```
supabase/
├── migrations/          # Migrações do banco
├── seed/               # Dados iniciais
├── functions/          # Edge Functions
├── config.toml         # Configuração do projeto
├── .env.example        # Exemplo de variáveis
└── README.md           # Esta documentação
```

## 🚀 Próximos Passos

1. **Criar conta institucional** no Supabase
2. **Configurar projeto** lattes-automator-ai
3. **Definir schema** do banco de dados
4. **Implementar autenticação** no frontend/backend
5. **Migrar dados** existentes (se necessário)
6. **Configurar RLS** (Row Level Security)

## 🔗 Links Úteis

- [Documentação Supabase](https://supabase.com/docs)
- [Supabase Dashboard](https://supabase.com/dashboard)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

---

**Status**: 🟡 Planejado - Implementação em andamento