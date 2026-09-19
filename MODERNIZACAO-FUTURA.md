# Modernizacao futura do site

Documento de pendencias arquiteturais. Nenhuma destas mudancas faz parte da correcao atual.

## Objetivo

Reduzir a concentracao de codigo em arquivos HTML gigantes, melhorar a previsibilidade do estado da aplicacao e facilitar manutencao, testes e evolucao visual.

## Direcao tecnica proposta

- [ ] Separar a wiki publica e o editor privado em aplicacoes/modulos independentes.
- [ ] Migrar gradualmente o editor privado para React.
- [ ] Usar Vite como ferramenta de desenvolvimento e build.
- [ ] Avaliar React Router para as telas do editor e rotas da wiki.
- [ ] Manter Firebase Authentication, Firestore, Storage e Cloud Functions.
- [ ] Manter as Cloud Functions em Node.js, separadas do frontend.
- [ ] Avaliar Tailwind CSS para tokens, layout responsivo e componentes consistentes.
- [ ] Usar Impeccable como guia de revisao visual, acessibilidade, tipografia, espacamento e estados de interface.

## Ordem sugerida

1. Extrair modulos JavaScript puros sem mudar o comportamento.
2. Separar modelos de dados, persistencia Firebase, renderizacao Markdown e regras de negocio.
3. Criar testes para serializacao Markdown, links `[[...]]`, spoilers, publicacao e permissoes.
4. Criar a nova aplicacao React/Vite ao lado da atual.
5. Migrar primeiro uma tela pequena e independente.
6. Migrar componentes reutilizaveis: modais, campos Markdown, seletores, abas e galerias.
7. Migrar o editor principal por areas, mantendo o formato de dados existente.
8. Migrar a wiki publica somente depois de estabilizar o editor.
9. Configurar build, deploy, PWA e cache do service worker no novo fluxo.
10. Remover codigo antigo apenas depois de comparar os fluxos em producao.

## Componentes candidatos

- `MarkdownEditor`
- `MarkdownPreview`
- `EntryForm`
- `EntryInfobox`
- `VisibilityControl`
- `GalleryEditor`
- `RelationshipGraph`
- `Timeline`
- `WikiTabs`
- `Modal`
- `AuthBar`
- `SyncStatus`
- `BackupImport`

## Cuidados

- React nao corrige sozinho problemas de CSS ou compatibilidade entre navegadores.
- A migracao nao deve alterar o modelo publico do Firestore sem planejamento.
- Regras de seguranca do Firebase devem continuar no backend.
- Chaves publicas do Firebase podem continuar no frontend; segredos nunca.
- O service worker deve usar estrategia de atualizacao clara para evitar assets antigos.
- A migracao deve preservar exportacao/importacao e backups antes de cada etapa.
- Tailwind deve ser adotado com tokens e componentes, nao como uma camada de classes sem padrao.

## Criterios para comecar

- [ ] O comportamento atual esta coberto por testes ou checklists manuais.
- [ ] O modelo de dados tem documentacao.
- [ ] O fluxo de backup foi testado.
- [ ] As regras do Firebase foram registradas e revisadas.
- [ ] Existe uma estrategia de rollback.
- [ ] A primeira tela escolhida pode coexistir com o editor atual.
