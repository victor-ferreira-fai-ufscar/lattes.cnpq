# Anotações

## Frontend

- [x] Verificar se o design system está padronizado (utilizando Shadcn UI) e se os componentes estão sendo reutilizados corretamente.
- [x] Deixar a parte do "resumo gerado" em baixo do "gerar resumo com IA"
- [x] Implementar um state persistente para as pesquisas e execuções, para que o usuário possa voltar e ver os resultados anteriores mesmo após fechar a aplicação. (Para quando ele dar F5 ou fechar e abrir novamente, os dados continuarem lá)
- [x] Adicionar um loading durante as requests para melhorar a experiência do usuário, indicando que a aplicação está processando a solicitação.
- [x] Adicionar um Smooth Scroll após as execuções para levar o usuário diretamente para a seção de resultados, melhorando a navegação e a experiência geral do usuário. (Adicionar um efeito de rolagem suave para levar o usuário diretamente para a seção de resultados após a execução, facilitando a visualização dos resultados gerados e melhorando a usabilidade da aplicação.)
- [x] Invés de mostrar um modal de loading (que fica com o bg escurecido), seria melhor um toast/sonner. Que fica fazendo o request do lado direito inferior, e quando terminar ele some, e aí o usuário pode ir lá ver os resultados. Assim não bloqueia a tela inteira, e o usuário pode continuar navegando ou lendo outras coisas enquanto espera o resultado chegar. (Adicionar um sistema de notificações tipo toast/sonner para indicar que a solicitação está sendo processada, permitindo que o usuário continue navegando ou lendo outras informações enquanto aguarda os resultados, melhorando a experiência geral da aplicação. Porém sem deixar a pessoa para interagir com outros elementos enquanto a requisição estiver em andamento, mas ela também pode cancelar quando quiser, e aí o toast some e a requisição é cancelada, para evitar que ela fique presa esperando caso queira cancelar ou fazer outra coisa.)
    - https://ui.shadcn.com/docs/components/radix/toast
    - https://ui.shadcn.com/docs/components/radix/sonner
- [x] Melhorar o markdown do "Resumo executivo e detalhes" para renderizar tabelas e etc (de forma mais bonita)
    - https://tx.shadcn.com/docs/documentation
- [x] Adicionar os erros no loading toast/sonner para mostrar quando der erro, e também adicionar um botão de retry para tentar novamente caso dê erro. (Adicionar um sistema de notificações tipo toast/sonner para indicar quando ocorrer um erro durante a solicitação, permitindo que o usuário saiba que algo deu errado e oferecendo a opção de tentar novamente com um botão de retry, melhorando a experiência geral da aplicação e facilitando a resolução de problemas.)
- [ ] Melhorar os metadados e favicon da aplicação para deixar mais personalizada e profissional. (Adicionar metadados personalizados, como título, descrição e favicon, para melhorar a identidade visual da aplicação e torná-la mais reconhecível e profissional para os usuários.)



## Detalhes da execução (`componente.tsx`)

- [x] Detalhes da execução (adicionar para o horário de Brasília GMT -3)

## Gerar resumo com IA (``)

- [ ] Melhorar o estado para as API Keys
- [x] Melhorar o render Markdown (deixar mais bonitinho) para a seção de resumo com IA e adicionar um button para copiar em markdown para facilitar

## Backend

- [x] Implementar um método de cache no Supabase Storage para buscar o PDF caso já exista e esteja o mais atualizado possível para não precisar fazer o scraping novamente, sendo que o dado já existe no Supabase Storage, e só fazer o scraping caso o PDF não exista ou esteja desatualizado (ex: mais de 1 mês) para otimizar o processo e evitar scraping desnecessário. O cache pode ser implementado utilizando a data de última modificação do arquivo no Supabase Storage para determinar se o PDF está atualizado ou não. Se o PDF estiver atualizado, ele pode ser retornado diretamente do cache, caso contrário, o scraping pode ser realizado para obter a versão mais recente do PDF.
- [ ] Adicionar os templates com base na lista de nomes e também pesquisa individual para gerar os arquivos de saída com base nos modelos [docx](../docx/) e também gerar os arquivos de saída em JSON, HTML, CSV (mas principalmente .docx) e outros formatos necessários para facilitar a utilização dos dados extraídos. (Adicionar um Select para o usuário escolher o formato de saída desejado, e também deixar um local específico para salvar os arquivos de saída gerados, como uma pasta "outputs" ou algo do tipo para organizar melhor os arquivos gerados e facilitar o acesso a eles. Caso for em lista, criar uma pasta para cada docente, e dentro dessa pasta salvar os arquivos de saída relacionados a esse docente específico, para manter uma organização clara dos arquivos gerados.)