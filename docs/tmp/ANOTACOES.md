# Anotações

## Frontend

- [x] Verificar se o design system está padronizado (utilizando Shadcn UI) e se os componentes estão sendo reutilizados corretamente.
- [x] Deixar a parte do "resumo gerado" em baixo do "gerar resumo com IA"
- [ ] Implementar um state persistente para as pesquisas e execuções, para que o usuário possa voltar e ver os resultados anteriores mesmo após fechar a aplicação. (Para quando ele dar F5 ou fechar e abrir novamente, os dados continuarem lá)

## Detalhes da execução (`componente.tsx`)

- [x] Detalhes da execução (adicionar para o horário de Brasília GMT -3)

## Gerar resumo com IA (``)

- [ ] Melhorar o estado para as API Keys
- [x] Melhorar o render Markdown (deixar mais bonitinho) para a seção de resumo com IA e adicionar um button para copiar em markdown para facilitar

## Backend

- [ ] Implementar um método de cache no Supabase Storage para buscar o PDF caso já exista e esteja o mais atualizado possível para não precisar fazer o scraping novamente, sendo que o dado já existe