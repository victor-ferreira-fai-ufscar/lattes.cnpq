# Para fazer (TODO)

- [ ] Adicionar um docker-compose para rodar o backend e o frontend juntos
- [ ] Adicionar a parte de seleção para o Gemini e o Ollama (para rodar localmente)
- [ ] Adicionar a flag/toggle para o usuário conseguir visualizar ou não o headless
- [ ] Verificar se é possível fazer um engenharia reversa e utilizar a API do Lattes (para não precisar fazer o scrapping)
  - [ ] 
 
## Lates

- [ ] Adicionar o input com os arquivos
- [ ] Escolher o local para salvar os arquivos 
- [ ] Lista de docentes (.txt ou .csv)
- [ ] Documento com template (Pegar com o Nicolas)
- [ ] Imprimir na pasta como arquivo output > .doc

Puxa as informações em JSON, HTML, CSV e etc.
- Template Mockado
- Texto corrido (sem organização) em uma pasta e texto estruturado (com organização) em outra
    - Adicionar as próximas listas
    - Filtragem para não repetir

- Informações do CV Lates para separar
    - Onde fez o doutorado
    - Onde fez mestrado
    - Onde fez graduação
    - Onde fez pós-doutorado

> Texto estruturados do CV Lattes, da entrevista e do CCS <https://www.ccs.ufscar.br/noticias>;

- Trajetória academica (buscar a trajetoria através do CV Lattes, pode chamar de Roadmap)
    - Formação e vinculo institucional
    - Trabalhei em uma universidade XYZ

## CCS UFSCAR 
- Link da matéria
https://www.ccs.ufscar.br/

> Fontes para o RAG (para buscar informações e fornecer todo o contexto)

- Usuario da plataforma Janela/VITRINE UFSCAR (dependemos do SAGUI <https://sistemas.ufscar.br/sagui/login>)
    - TokenLAB empresa contratada para desenvolver
    - SIn (<https://www.sin.ufscar.br/>)
    - Alessandra Cubas
        - CCS

    - Quem trabalha com aquilo que o usuário quer saber/buscar?

- Fonte do Lattes
- Matérias divulgadas na midia CCS
    - https://www.ccs.ufscar.br/noticias
    - Chatbot (plataforma Janela UFSCAR)

- Como pegar essas matérias (através do servidor ou Scrapping <https://www.ccs.ufscar.br/>)

---

- Formação:
    - Graduação
    - Doutorado
    - Mestrado
    - Pós-doutorado
    - Etc.
- Vínculo institucional
    - Universidades
- Transcrição (resumo doc)
- Template (doc estruturado)
- Instruções

---

- Adicionar o Storage do Supabase
- Lista de nomes profissionais (docentes) com .csv ou .txt
    - 50 docentes
    - Departamentos diferentes
