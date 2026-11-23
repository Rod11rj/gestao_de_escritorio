# Gestão da Equipe

Sistema web para organizar o trabalho de uma equipe em seções. Cada seção tem um quadro de tarefas (Kanban) e um calendário de atividades.

Funciona no navegador, sem servidor e sem instalação. Os dados ficam no próprio navegador.

<!-- Após o primeiro release, substitua XXXXXXX pelo DOI do Zenodo:
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.XXXXXXX.svg)](https://doi.org/10.5281/zenodo.XXXXXXX)
-->

## Funcionalidades

- Seções criadas e organizadas pelo usuário
- Tarefas com grupo, prioridade, responsável, prazo, referência, situação e checklist
- Calendário de atividades por entidade e lista de solicitações
- Exportação em PDF, backup em JSON e modo escuro

## Uso

Acesse a página do projeto no GitHub Pages ou baixe o pacote da versão e abra o `index.html` no navegador.

Os dados são salvos no `localStorage` do navegador. Faça backup pelo botão **Exportar backup**. Limpar os dados do navegador apaga as informações não exportadas.

## Estrutura

```
index.html      estrutura da página
css/            estilos
js/             código da aplicação
  modules/      quadro de tarefas e calendário
  dialogs/      janelas de edição
tests/          testes automatizados
```

## Desenvolvimento

Requer Node.js 18 ou superior.

```bash
npm install
npx playwright install chromium
npm test
npm run lint
```

## Citação

Veja [`CITATION.cff`](CITATION.cff) ou use o botão **Cite this repository** do GitHub.

## Licença

[MIT](LICENSE)
