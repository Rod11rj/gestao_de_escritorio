# Gestão da Equipe

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.24484027.svg)](https://doi.org/10.5281/zenodo.24484027)

Sistema web para organizar o trabalho de uma equipe em seções. Cada seção tem um quadro de tarefas (Kanban) e um calendário de atividades.

Funciona no navegador, sem servidor e sem instalação. Os dados ficam no próprio navegador.

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


## Citação

Almeida, R. (2026). *Gestão da Equipe: sistema web de tarefas e calendário de atividades* (v1.0.0). Zenodo. https://doi.org/10.5281/zenodo.24484027

Veja também [`CITATION.cff`](CITATION.cff) ou o botão **Cite this repository** do GitHub.

## Licença

[MIT](LICENSE)

Software desenvolvido com apoio de Inteligência Artificial
