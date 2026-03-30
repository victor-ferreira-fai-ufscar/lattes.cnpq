# Anotações

## Frontend

- [x] Verificar se o design system está padronizado (utilizando Shadcn UI) e se os componentes estão sendo reutilizados corretamente.
- [x] Deixar a parte do "resumo gerado" em baixo do "gerar resumo com IA"
- [x] Implementar um state persistente para as pesquisas e execuções, para que o usuário possa voltar e ver os resultados anteriores mesmo após fechar a aplicação. (Para quando ele dar F5 ou fechar e abrir novamente, os dados continuarem lá)

## Detalhes da execução (`componente.tsx`)

- [x] Detalhes da execução (adicionar para o horário de Brasília GMT -3)

## Gerar resumo com IA (``)

- [ ] Melhorar o estado para as API Keys
- [x] Melhorar o render Markdown (deixar mais bonitinho) para a seção de resumo com IA e adicionar um button para copiar em markdown para facilitar

## Backend

- [x] Implementar um método de cache no Supabase Storage para buscar o PDF caso já exista e esteja o mais atualizado possível para não precisar fazer o scraping novamente, sendo que o dado já existe no Supabase Storage, e só fazer o scraping caso o PDF não exista ou esteja desatualizado (ex: mais de 1 mês) para otimizar o processo e evitar scraping desnecessário. O cache pode ser implementado utilizando a data de última modificação do arquivo no Supabase Storage para determinar se o PDF está atualizado ou não. Se o PDF estiver atualizado, ele pode ser retornado diretamente do cache, caso contrário, o scraping pode ser realizado para obter a versão mais recente do PDF.