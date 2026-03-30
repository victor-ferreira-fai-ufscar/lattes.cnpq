# TODO

Checklist consolidado para acompanhar a evolucao do projeto.

## Prioridade alta (proximos passos)

### Frontend

- [x] Ajustar detalhes da execucao para horario de Brasilia (GMT-3).
- [ ] Melhorar estado e fluxo das API Keys.
- [x] Melhorar renderizacao de Markdown na secao de resumo com IA.
- [x] Adicionar botao para copiar resumo em Markdown.
- [ ] Adicionar selecao de provedor de IA (Gemini e Ollama).
- [ ] Adicionar toggle para visualizar execucao headless ou nao.

### Backend e infraestrutura

- [ ] Revisar/garantir docker-compose para subir backend e frontend juntos.
- [ ] Implementar cache no Supabase Storage para reutilizar PDF quando estiver atualizado.
- [ ] Adicionar suporte completo de storage no Supabase.
- [ ] Implementar entrada de lista de docentes via .csv ou .txt.

### Saida e organizacao de arquivos

- [ ] Permitir input de arquivos no fluxo principal.
- [ ] Definir/escolher local de salvamento dos arquivos de saida.
- [ ] Gerar saidas em JSON, HTML, CSV e formatos necessarios.
- [ ] Manter texto corrido (raw) e texto estruturado em pastas separadas.
- [ ] Adicionar filtro para evitar repeticao de itens.

## Conteudo e template

- [ ] Obter template oficial do documento (com Nicolas).
- [ ] Criar template mockado inicial para validacao.
- [ ] Gerar documento estruturado final em .doc.
- [ ] Incluir instrucoes de uso do template no fluxo.

## Extracao de informacoes do Lattes

- [ ] Estruturar extracao de formacao academica (graduacao, mestrado, doutorado, pos-doutorado etc.).
- [ ] Estruturar extracao de vinculo institucional (universidades e historico).
- [ ] Mapear e gerar "trajetoria academica" (roadmap) com base no CV.

## Fontes externas e RAG

- [ ] Verificar viabilidade de usar API do Lattes (engenharia reversa) para reduzir scraping.
- [ ] Definir fontes para RAG (Lattes, entrevistas e noticias CCS).
- [ ] Integrar noticias do CCS: https://www.ccs.ufscar.br/noticias
- [ ] Avaliar melhor estrategia para capturar conteudo do CCS (servidor/API vs scraping).
- [ ] Mapear integracao com plataforma Janela/Vitrine UFSCar (dependencia SAGUI).

## Dados de entrada

- [ ] Consolidar lista inicial de docentes (50 nomes, departamentos diferentes).